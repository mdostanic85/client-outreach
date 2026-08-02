import { desc, eq } from "drizzle-orm";
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
  type JobSearchParams,
  type SearchProfileLlm,
} from "./schemas";

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1]!.trim() : trimmed);
}

function nextVersion(): number {
  const latest = getDb()
    .select({ version: jobSearchProfiles.version })
    .from(jobSearchProfiles)
    .orderBy(desc(jobSearchProfiles.version))
    .get();
  return (latest?.version ?? 0) + 1;
}

/** Deterministic fallback when LLM unavailable — still human-reviewable. */
export function deriveSearchParamsFromProfile(): {
  params: JobSearchParams;
  rationale: string[];
} {
  const p = getMatchingProfile();
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
    sourcesEnabled: locations.some((l) => /serbia|belgrade|balkan/i.test(l))
      ? [
          "remotive",
          "arbeitnow",
          "greenhouse",
          "lever",
          "ashby",
          "linkedin",
          "helloworld",
          "infostud",
        ]
      : [
          "remotive",
          "arbeitnow",
          "greenhouse",
          "lever",
          "ashby",
          "linkedin",
          "helloworld",
        ],
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
  assertPublicBudgetAllows("jobSearchProfile");
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
  const approved = getApprovedProfile();
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
      const derived = deriveSearchParamsFromProfile();
      params = derived.params;
      rationale = derived.rationale;
    }
  } else {
    const derived = deriveSearchParamsFromProfile();
    params = derived.params;
    rationale = derived.rationale;
  }

  const db = getDb();
  const version = nextVersion();
  const id = newId("jsp");
  db.insert(jobSearchProfiles)
    .values({
      id,
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
    })
    .run();

  logger.info({ id, version, usedLlm, trigger }, "job search profile draft created");
  return { id, version, usedLlm };
}

export function saveSearchProfileDraft(
  id: string,
  params: JobSearchParams,
  rationale?: string[],
): void {
  const db = getDb();
  const row = db
    .select()
    .from(jobSearchProfiles)
    .where(eq(jobSearchProfiles.id, id))
    .get();
  if (!row) throw new Error("Search profile not found");
  if (row.status !== "draft") {
    throw new Error("Only draft search profiles can be edited");
  }
  const parsed = JobSearchParamsSchema.parse(params);
  db.update(jobSearchProfiles)
    .set({
      paramsJson: JSON.stringify(parsed),
      ...(rationale ? { rationaleJson: JSON.stringify(rationale) } : {}),
    })
    .where(eq(jobSearchProfiles.id, id))
    .run();
}

/** Ensure a structured profile row still exists (for typing). */
export function assertStructuredProfileExists(id: string) {
  const row = getDb()
    .select()
    .from(structuredProfiles)
    .where(eq(structuredProfiles.id, id))
    .get();
  if (!row) throw new Error("Structured profile missing");
}
