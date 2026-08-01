import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { profileSources, structuredProfiles } from "@/db/schema";
import { anthropicProvider } from "@/lib/ai/anthropic";
import { buildMessages, googleProvider } from "@/lib/ai/google";
import {
  loadPrompt,
  PROFILE_EXTRACT_PROMPT_VERSION,
} from "@/lib/ai/prompts";
import { resolveModel, TASK_ROUTES } from "@/lib/ai/routing";
import { assertPublicBudgetAllows } from "@/lib/budgets";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { redactPii } from "./redact";
import {
  StructuredProfileSchema,
  type StructuredProfile,
} from "./schemas";

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]!.trim() : trimmed);
}

function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function nextVersion(): number {
  const latest = getDb()
    .select({ version: structuredProfiles.version })
    .from(structuredProfiles)
    .orderBy(desc(structuredProfiles.version))
    .get();
  return (latest?.version ?? 0) + 1;
}

function inventsClaims(
  profile: StructuredProfile,
  corpus: string,
): string[] {
  const lower = corpus.toLowerCase();
  const issues: string[] = [];
  for (const project of profile.relevantProjects) {
    const title = project.title.trim();
    if (title.length < 3) continue;
    // Require at least one significant token from the title in the corpus
    const tokens = title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4);
    if (tokens.length === 0) continue;
    const hit = tokens.some((t) => lower.includes(t));
    if (!hit) {
      issues.push(`Project not grounded in sources: ${title}`);
    }
  }
  return issues;
}

async function callExtract(system: string, user: string): Promise<{
  text: string;
  model: string;
  usedPrivate: boolean;
}> {
  assertPublicBudgetAllows("profileExtract");

  if (hasAnthropicKey()) {
    const model = resolveModel("profileExtract");
    const completion = await anthropicProvider.complete({
      model,
      messages: buildMessages(system, user),
      task: "profileExtract",
      temperature: 0.2,
      maxTokens: 4096,
    });
    return { text: completion.text, model, usedPrivate: true };
  }

  // Public fallback with PII redaction (resolved decision #1)
  logger.warn("ANTHROPIC_API_KEY missing — profile extract using public model with PII redaction");
  const model =
    process.env[TASK_ROUTES.researchAndScore.modelEnv] ??
    TASK_ROUTES.researchAndScore.defaultModel;
  const completion = await googleProvider.complete({
    model,
    messages: buildMessages(system, user),
    task: "profileExtract",
    temperature: 0.2,
    jsonMode: true,
  });
  return { text: completion.text, model, usedPrivate: false };
}

export async function extractStructuredProfile(options?: {
  sourceIds?: string[];
}): Promise<{
  profileId: string;
  version: number;
  model: string;
  usedPrivate: boolean;
  groundingIssues: string[];
}> {
  const db = getDb();
  let sources = db.select().from(profileSources).all();
  if (options?.sourceIds?.length) {
    sources = db
      .select()
      .from(profileSources)
      .where(inArray(profileSources.id, options.sourceIds))
      .all();
  }
  sources = sources.filter((s) => (s.rawText ?? "").trim().length > 0);
  if (sources.length === 0) {
    throw new Error("Add at least one profile source before extracting");
  }

  const corpusParts = sources.map((s) => {
    const header = [
      `### Source ${s.id}`,
      `type: ${s.type}`,
      s.label ? `label: ${s.label}` : null,
      s.sourceUrl ? `url: ${s.sourceUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    return `${header}\n\n${s.rawText}`;
  });
  const corpus = corpusParts.join("\n\n---\n\n");
  const usedPrivate = hasAnthropicKey();
  const payloadCorpus = usedPrivate ? corpus : redactPii(corpus);

  const system = loadPrompt("profile/extract.md");
  const user = JSON.stringify(
    {
      instruction: "Extract a grounded structured profile from these sources.",
      sources: payloadCorpus,
    },
    null,
    2,
  );

  let parsed: StructuredProfile;
  let model: string;
  let privatePath: boolean;

  try {
    const first = await callExtract(system, user);
    model = first.model;
    privatePath = first.usedPrivate;
    parsed = StructuredProfileSchema.parse(parseJsonLoose(first.text));
  } catch (err) {
    logger.warn({ err }, "profile extract parse failed — retrying once");
    const retry = await callExtract(
      system,
      `${user}\n\n## Rewrite required\nPrevious output was invalid JSON or failed schema. Return ONLY valid JSON matching the schema.`,
    );
    model = retry.model;
    privatePath = retry.usedPrivate;
    parsed = StructuredProfileSchema.parse(parseJsonLoose(retry.text));
  }

  const groundingIssues = inventsClaims(parsed, corpus);
  if (groundingIssues.length) {
    parsed = {
      ...parsed,
      groundingNotes: [
        ...parsed.groundingNotes,
        ...groundingIssues.map((i) => `post-check: ${i}`),
      ],
      // Drop ungrounded projects
      relevantProjects: parsed.relevantProjects.filter((p) => {
        const title = p.title.trim();
        const tokens = title
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((t) => t.length >= 4);
        if (tokens.length === 0) return true;
        return tokens.some((t) => corpus.toLowerCase().includes(t));
      }),
    };
  }

  const version = nextVersion();
  const id = newId("sprof");
  db.insert(structuredProfiles)
    .values({
      id,
      version,
      status: "draft",
      profileJson: JSON.stringify(parsed),
      sourceIdsJson: JSON.stringify(sources.map((s) => s.id)),
      modelId: model,
      promptVersion: PROFILE_EXTRACT_PROMPT_VERSION,
      createdAt: nowIso(),
      approvedAt: null,
    })
    .run();

  logger.info(
    { id, version, model, privatePath, groundingIssues: groundingIssues.length },
    "structured profile draft created",
  );

  return {
    profileId: id,
    version,
    model,
    usedPrivate: privatePath,
    groundingIssues,
  };
}

export function saveDraftProfileEdits(
  profileId: string,
  profile: StructuredProfile,
): void {
  const db = getDb();
  const row = db
    .select()
    .from(structuredProfiles)
    .where(eq(structuredProfiles.id, profileId))
    .get();
  if (!row) throw new Error("Profile not found");
  if (row.status !== "draft") {
    throw new Error("Only draft profiles can be edited — extract a new version instead");
  }
  const validated = StructuredProfileSchema.parse(profile);
  db.update(structuredProfiles)
    .set({ profileJson: JSON.stringify(validated) })
    .where(eq(structuredProfiles.id, profileId))
    .run();
}

/**
 * Copy the approved profile into a new draft so the user can edit
 * (preferences, compensation, etc.) without re-extracting sources.
 */
export function createDraftFromApprovedProfile(): {
  profileId: string;
  version: number;
} {
  const db = getDb();
  const existingDraft = db
    .select()
    .from(structuredProfiles)
    .where(eq(structuredProfiles.status, "draft"))
    .orderBy(desc(structuredProfiles.version))
    .limit(1)
    .get();
  if (existingDraft) {
    return { profileId: existingDraft.id, version: existingDraft.version };
  }

  const approved = db
    .select()
    .from(structuredProfiles)
    .where(eq(structuredProfiles.status, "approved"))
    .orderBy(desc(structuredProfiles.version))
    .limit(1)
    .get();
  if (!approved) {
    throw new Error("Approve a profile first, or extract a draft from sources");
  }

  const maxVersion =
    db
      .select()
      .from(structuredProfiles)
      .orderBy(desc(structuredProfiles.version))
      .limit(1)
      .get()?.version ?? approved.version;

  const id = newId("sprof");
  const version = maxVersion + 1;
  const profile = StructuredProfileSchema.parse(
    JSON.parse(approved.profileJson || "{}"),
  );

  db.insert(structuredProfiles)
    .values({
      id,
      version,
      status: "draft",
      profileJson: JSON.stringify(profile),
      sourceIdsJson: approved.sourceIdsJson,
      modelId: approved.modelId,
      promptVersion: approved.promptVersion,
      createdAt: nowIso(),
      approvedAt: null,
    })
    .run();

  logger.info(
    { profileId: id, version, from: approved.id },
    "structured profile draft forked from approved",
  );

  return { profileId: id, version };
}
