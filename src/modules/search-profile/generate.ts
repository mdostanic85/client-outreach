import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobSearchProfiles, structuredProfiles } from "@/db/schema";
import { buildMessages, googleProvider } from "@/lib/ai/google";
import {
  JOB_SEARCH_PROFILE_PROMPT_VERSION,
  loadPrompt,
} from "@/lib/ai/prompts";
import { resolveModel } from "@/lib/ai/routing";
import { assertPublicBudgetAllows } from "@/lib/budgets";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import {
  getApprovedProfile,
  getMatchingProfile,
} from "@/modules/profile/queries";
import { formatCompensation } from "@/modules/profile/schemas";
import {
  EMPTY_SEARCH_PARAMS,
  JobSearchParamsSchema,
  SearchProfileLlmSchema,
  withMarketDefaults,
  type JobSearchParams,
  type SearchProfileLlm,
} from "./schemas";
import { currentUserId, owned } from "@/modules/auth/current-user";

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]!.trim() : trimmed);
}

async function nextVersion(): Promise<number> {
  const latest = (await getDb()
    .select({ version: jobSearchProfiles.version })
    .from(jobSearchProfiles)
    .where(await owned(jobSearchProfiles))
    .orderBy(desc(jobSearchProfiles.version)).limit(1))[0];
  return (latest?.version ?? 0) + 1;
}

/** Deterministic fallback when LLM unavailable — still human-reviewable. */
export async function deriveSearchParamsFromProfile(): Promise<{
  params: JobSearchParams;
  rationale: string[];
}> {
  const p = await getMatchingProfile();
  const titles =
    p?.targetRoles?.length ?
      p.targetRoles.slice(0, 5)
    : p?.currentRole ?
      [p.currentRole, `Senior ${p.currentRole}`].filter(Boolean).slice(0, 5)
    : EMPTY_SEARCH_PARAMS.targetTitles;

  const excluded = [
    ...(p?.rolesBelowLevel ?? []),
    "Junior Designer",
    "Intern",
    "Graphic Designer",
    "Product Manager",
  ];

  const locations =
    p?.preferredLocations?.length ?
      p.preferredLocations.slice(0, 5)
    : EMPTY_SEARCH_PARAMS.locations;

  const params = JobSearchParamsSchema.parse({
    ...EMPTY_SEARCH_PARAMS,
    targetTitles: titles,
    excludedTitles: [...new Set(excluded)],
    locations,
    employmentTypes:
      p?.preferredEmploymentTypes?.length ?
        p.preferredEmploymentTypes
      : EMPTY_SEARCH_PARAMS.employmentTypes,
    searchKeywords: [
      ...(p?.strongestSkills ?? []).slice(0, 5),
      ...(p?.designTools ?? []).slice(0, 3),
      ...(p?.productTypes ?? []).slice(0, 3),
    ],
    requiredSkills: (p?.strongestSkills ?? []).slice(0, 4),
    preferredSkills: [
      ...(p?.designTools ?? []),
      ...(p?.technicalTools ?? []),
    ].slice(0, 6),
    seniority: p?.seniority ? [p.seniority.toLowerCase()] : ["senior", "lead"],
    priorityIndustries: (p?.industries ?? []).slice(0, 5),
    salary: {
      min: p?.compensation?.min ?? null,
      currency: p?.compensation?.currency ?? "EUR",
      notes: formatCompensation(p?.compensation) ?? p?.salaryOrRateExpectations ?? "",
    },
    sourcesEnabled: [...EMPTY_SEARCH_PARAMS.sourcesEnabled],
    atsBoardUrls: EMPTY_SEARCH_PARAMS.atsBoardUrls,
  });

  return {
    params,
    rationale: [
      "Derived from approved structured profile without LLM",
      "Review titles, locations, and exclusions before approving",
    ],
  };
}

async function callLlm(profileJson: string): Promise<{
  parsed: SearchProfileLlm;
  model: string;
  costUsd: number;
}> {
  await assertPublicBudgetAllows("jobSearchProfile");
  const system = loadPrompt("jobs/search-profile.md");
  const model = resolveModel("jobSearchProfile");
  const user = `Approved structured profile JSON:\n${profileJson}\n\nGenerate the job search profile JSON.`;

  const tryOnce = async () => {
    const completion = await googleProvider.complete({
      model,
      messages: buildMessages(system, user),
      task: "jobSearchProfile",
      temperature: 0.2,
      jsonMode: true,
    });
    const parsed = SearchProfileLlmSchema.parse(parseJsonLoose(completion.text));
    return { parsed, model, costUsd: completion.estimatedCost ?? 0 };
  };

  try {
    return await tryOnce();
  } catch (err) {
    logger.warn({ err }, "job search profile LLM parse failed — retrying");
    return await tryOnce();
  }
}

export type GenerationTrigger =
  | "profile_approved"
  | "profile_changed"
  | "feedback_batch"
  | "irrelevant_streak"
  | "weekly_insight"
  | "strategy_cycle"
  | "manual";

/**
 * Generate a draft search profile from the approved structured profile.
 * Does not auto-approve.
 */
export async function generateSearchProfile(options?: {
  trigger?: GenerationTrigger;
  useLlm?: boolean;
}): Promise<{
  id: string;
  version: number;
  usedLlm: boolean;
}> {
  const approved = await getApprovedProfile();
  if (!approved) {
    throw new Error("Approve a structured profile before generating search criteria");
  }

  const trigger = options?.trigger ?? "manual";
  const useLlm = options?.useLlm !== false;
  let params: JobSearchParams;
  let rationale: string[];
  let modelId: string | null = null;
  let costUsd: number | null = null;
  let usedLlm = false;

  if (useLlm && process.env.GOOGLE_API_KEY?.trim()) {
    try {
      const result = await callLlm(JSON.stringify(approved.profile, null, 2));
      const { rationale: r, ...rest } = result.parsed;
      params = JobSearchParamsSchema.parse(rest);
      rationale = r;
      modelId = result.model;
      costUsd = result.costUsd;
      usedLlm = true;
    } catch (err) {
      logger.warn({ err }, "LLM search profile failed — using deterministic derive");
      const derived = await deriveSearchParamsFromProfile();
      params = derived.params;
      rationale = derived.rationale;
    }
  } else {
    const derived = await deriveSearchParamsFromProfile();
    params = derived.params;
    rationale = derived.rationale;
  }
  params = withMarketDefaults(params);

  const db = getDb();
  const version = await nextVersion();
  const id = newId("jsp");
  await db.insert(jobSearchProfiles)
    .values({
      id,
      userId: await currentUserId(),
      version,
      status: "draft",
      structuredProfileId: approved.id,
      structuredProfileVersion: approved.version,
      paramsJson: JSON.stringify(params),
      rationaleJson: JSON.stringify(rationale),
      generationTrigger: trigger,
      modelId,
      promptVersion: JOB_SEARCH_PROFILE_PROMPT_VERSION,
      costUsd,
      createdAt: nowIso(),
    });

  logger.info({ id, version, usedLlm, trigger }, "job search profile draft created");
  return { id, version, usedLlm };
}

export async function saveSearchProfileDraft(
  id: string,
  params: JobSearchParams,
  rationale?: string[],
): Promise<void> {
  const db = getDb();
  const row = (await db
    .select()
    .from(jobSearchProfiles)
    .where(and(await owned(jobSearchProfiles), eq(jobSearchProfiles.id, id))).limit(1))[0];
  if (!row) throw new Error("Search profile not found");
  if (row.status !== "draft") {
    throw new Error("Only draft search profiles can be edited");
  }
  const parsed = JobSearchParamsSchema.parse(params);
  await db.update(jobSearchProfiles)
    .set({
      paramsJson: JSON.stringify(parsed),
      ...(rationale ? { rationaleJson: JSON.stringify(rationale) } : {}),
    })
    .where(and(await owned(jobSearchProfiles), eq(jobSearchProfiles.id, id)));
}

/**
 * Fork the approved search profile into a draft so edits can be reviewed
 * and re-approved. Pass `params` to keep in-progress form edits.
 */
export async function createDraftFromApprovedSearchProfile(options?: {
  params?: JobSearchParams;
  rationale?: string[];
}): Promise<{ id: string; version: number }> {
  const db = getDb();
  const existingDraft = (await db
    .select()
    .from(jobSearchProfiles)
    .where(and(await owned(jobSearchProfiles), eq(jobSearchProfiles.status, "draft")))
    .orderBy(desc(jobSearchProfiles.version))
    .limit(1))[0];
  if (existingDraft) {
    if (options?.params) {
      await saveSearchProfileDraft(
        existingDraft.id,
        options.params,
        options.rationale,
      );
    }
    return { id: existingDraft.id, version: existingDraft.version };
  }

  const approved = (await db
    .select()
    .from(jobSearchProfiles)
    .where(and(await owned(jobSearchProfiles), eq(jobSearchProfiles.status, "approved")))
    .orderBy(desc(jobSearchProfiles.version))
    .limit(1))[0];
  if (!approved) {
    throw new Error("Approve search criteria first, or generate a draft");
  }

  const params = JobSearchParamsSchema.parse(
    options?.params ?? JSON.parse(approved.paramsJson || "{}"),
  );
  let rationale: string[] = options?.rationale ?? [];
  if (!options?.rationale) {
    try {
      rationale = JSON.parse(approved.rationaleJson || "[]") as string[];
    } catch {
      rationale = [];
    }
  }

  const id = newId("jsp");
  const version = await nextVersion();
  await db.insert(jobSearchProfiles).values({
    id,
    userId: await currentUserId(),
    version,
    status: "draft",
    structuredProfileId: approved.structuredProfileId,
    structuredProfileVersion: approved.structuredProfileVersion,
    paramsJson: JSON.stringify(params),
    rationaleJson: JSON.stringify(rationale),
    generationTrigger: "manual",
    parentVersion: approved.version,
    modelId: approved.modelId,
    promptVersion: approved.promptVersion,
    createdAt: nowIso(),
  });

  logger.info(
    { id, version, parentVersion: approved.version },
    "job search profile draft forked from approved",
  );
  return { id, version };
}

/** Ensure a structured profile row still exists (for typing). */
export async function assertStructuredProfileExists(id: string) {
  const row = (await getDb()
    .select()
    .from(structuredProfiles)
    .where(and(await owned(structuredProfiles), eq(structuredProfiles.id, id))).limit(1))[0];
  if (!row) throw new Error("Structured profile missing");
}
