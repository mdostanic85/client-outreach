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
import {
  formatCompensation,
  type StructuredProfile,
} from "@/modules/profile/schemas";
import { getOccupation } from "@/modules/occupations/catalog";
import { FAMILY_PROFILES, type OccupationFamily } from "@/modules/occupations/families";
import {
  findOccupation,
  occupationSearchTerms,
  resolveFamily,
} from "@/modules/occupations/search";
import {
  EMPTY_SEARCH_PARAMS,
  JobSearchParamsSchema,
  SearchProfileLlmSchema,
  withMarketDefaults,
  type JobSearchParams,
  type SearchProfileLlm,
} from "./schemas";
import { currentUserId, owned } from "@/modules/auth/current-user";
import { applyRemoteChoice, applySurveyToSearchParams, getSurvey } from "@/modules/onboarding/survey";
import { getApprovedSearchProfile } from "./queries";
import { spreadTitles, widenFromApproved } from "./widen";

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

export type OccupationContext = {
  family: OccupationFamily | null;
  occupationId: string | null;
  /** Catalog names in English and Serbian; empty for unknown titles. */
  synonyms: string[];
};

/** What we know about the person's occupation, from the survey or the titles. */
export function occupationContext(
  profile: Pick<StructuredProfile, "occupationId" | "occupationFamily" | "targetRoles" | "currentRole"> | null,
): OccupationContext {
  const occ =
    getOccupation(profile?.occupationId) ??
    findOccupation(profile?.targetRoles?.[0]) ??
    findOccupation(profile?.currentRole);
  return {
    family: resolveFamily(profile) ?? occ?.family ?? null,
    occupationId: occ?.id ?? null,
    synonyms: occ ? occupationSearchTerms(occ) : [],
  };
}

/** Deterministic fallback when LLM unavailable — still human-reviewable. */
export async function deriveSearchParamsFromProfile(): Promise<{
  params: JobSearchParams;
  rationale: string[];
}> {
  const p = await getMatchingProfile();
  const occ = occupationContext(p);
  const catalogTitle = getOccupation(occ.occupationId)?.en;
  const titles = p?.targetRoles?.length
    ? p.targetRoles.slice(0, 5)
    : [p?.currentRole, catalogTitle].filter((t): t is string => Boolean(t)).slice(0, 5);
  if (titles.length === 0) {
    throw new Error("Add the job you're looking for to your profile first.");
  }

  const locations = p?.preferredLocations?.length
    ? p.preferredLocations.slice(0, 5)
    : EMPTY_SEARCH_PARAMS.locations;
  const remoteOnly = locations.every((loc) => /remote/i.test(loc));

  const params = JobSearchParamsSchema.parse({
    ...EMPTY_SEARCH_PARAMS,
    occupationFamily: occ.family ?? undefined,
    occupationId: occ.occupationId ?? undefined,
    targetTitles: titles,
    titleSynonyms: occ.synonyms,
    excludedTitles: [...new Set(p?.rolesBelowLevel ?? [])],
    locations,
    employmentTypes:
      p?.preferredEmploymentTypes?.length ?
        p.preferredEmploymentTypes
      : EMPTY_SEARCH_PARAMS.employmentTypes,
    searchKeywords: [
      ...(p?.strongestSkills ?? []).slice(0, 5),
      ...(p?.tools ?? []).slice(0, 3),
    ],
    requiredSkills: (p?.strongestSkills ?? []).slice(0, 4),
    preferredSkills: (p?.tools ?? []).slice(0, 6),
    seniority: p?.seniority ? [p.seniority.toLowerCase()] : [],
    remoteRequired: remoteOnly,
    remotePolicy: remoteOnly ? "remote_ok_required" : "any",
    priorityIndustries: (p?.industries ?? []).slice(0, 5),
    salary: {
      min: p?.compensation?.min ?? null,
      currency: p?.compensation?.currency ?? "EUR",
      notes: formatCompensation(p?.compensation) ?? p?.salaryOrRateExpectations ?? "",
    },
  });

  return {
    params,
    rationale: [
      "Derived from approved structured profile without LLM",
      "Review titles, locations, and exclusions before approving",
    ],
  };
}

async function callLlm(profileJson: string, occ: OccupationContext): Promise<{
  parsed: SearchProfileLlm;
  model: string;
  costUsd: number;
}> {
  await assertPublicBudgetAllows("jobSearchProfile");
  const system = loadPrompt("jobs/search-profile.md");
  const model = resolveModel("jobSearchProfile");
  const family = occ.family ? FAMILY_PROFILES[occ.family].label : "unknown";
  const known = occ.synonyms.length ? occ.synonyms.join(", ") : "none";
  const user = `Occupation family: ${family}\nKnown names for this job: ${known}\n\nApproved structured profile JSON:\n${profileJson}\n\nGenerate the job search profile JSON.`;

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

/**
 * Generated criteria answer to what the person chose, and never search
 * narrower than what they already approved (see `widen.ts`):
 * survey answers win, document-only hints stay soft, and the result keeps
 * every title, place and source of the approved criteria.
 */
async function applyPersonsChoices(params: JobSearchParams): Promise<JobSearchParams> {
  const [survey, approved] = await Promise.all([getSurvey(), getApprovedSearchProfile()]);
  let next = Object.keys(survey).length ? applySurveyToSearchParams(params, survey) : params;
  next = widenFromApproved(next, approved?.params);
  next = applyRemoteChoice(next, survey);
  return { ...next, ...spreadTitles(next.targetTitles, next.titleSynonyms) };
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
  const occ = occupationContext(approved.profile);

  const trigger = options?.trigger ?? "manual";
  const useLlm = options?.useLlm !== false;
  let params: JobSearchParams;
  let rationale: string[];
  let modelId: string | null = null;
  let costUsd: number | null = null;
  let usedLlm = false;

  if (useLlm && process.env.GOOGLE_API_KEY?.trim()) {
    try {
      const result = await callLlm(JSON.stringify(approved.profile, null, 2), occ);
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
  params = withMarketDefaults(params, occ);
  params = await applyPersonsChoices(params);

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
