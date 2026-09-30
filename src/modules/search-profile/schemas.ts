import { z } from "zod";
import { OccupationFamilySchema, type OccupationFamily } from "@/modules/occupations/families";
import { findOccupation, occupationSearchTerms } from "@/modules/occupations/search";
import { planSources } from "@/modules/occupations/sources";

export const JobSourceSchema = z.enum([
  "remotive",
  "arbeitnow",
  "greenhouse",
  "lever",
  "ashby",
  "infostud",
  "helloworld",
  "linkedin",
  "manual",
  "apify",
]);

export type JobSource = z.infer<typeof JobSourceSchema>;

/** Companies that moved ATS; saved profiles still point at the dead board. */
const MOVED_ATS_BOARDS: Record<string, string> = {
  "https://boards.greenhouse.io/notion": "https://jobs.ashbyhq.com/notion",
  "https://jobs.lever.co/vercel": "https://boards.greenhouse.io/vercel",
};

/** Serbia is the first market: a search with no location looks there. */
export const HOME_MARKET = "Serbia";

function uniqueCaseless(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fits a generated search to the occupation: boards chosen by family and
 * location, synonyms for title matching, and remote only when the person
 * chose it. Used when a search profile is generated.
 */
export function withMarketDefaults(
  params: JobSearchParams,
  occupation: {
    family: OccupationFamily | null;
    occupationId?: string | null;
    synonyms?: string[];
  } = { family: params.occupationFamily ?? null },
): JobSearchParams {
  const locations = uniqueCaseless(params.locations).slice(0, 5);
  if (locations.length === 0) locations.push(HOME_MARKET);
  const remoteAllowed =
    params.remoteRequired || locations.some((loc) => /remote/i.test(loc));
  const plan = planSources({
    family: occupation.family,
    locations,
    remoteAllowed,
  });
  return {
    ...params,
    occupationFamily: occupation.family ?? params.occupationFamily,
    occupationId: occupation.occupationId ?? params.occupationId,
    titleSynonyms: uniqueCaseless([
      ...params.titleSynonyms,
      ...(occupation.synonyms ?? []),
    ]).slice(0, 16),
    locations,
    sourcesEnabled: plan.sourcesEnabled,
    atsBoardUrls: plan.atsBoardUrls,
  };
}

export const JobSearchParamsSchema = z.object({
  /** Set from the survey; drives sources, filters and scoring weights. */
  occupationFamily: OccupationFamilySchema.optional(),
  occupationId: z.string().optional(),
  targetTitles: z.array(z.string()).min(1),
  /** Other names for the same job (both languages) — widen search and title matching. */
  titleSynonyms: z.array(z.string()).default([]),
  excludedTitles: z.array(z.string()).default([]),
  locations: z.array(z.string()).min(1),
  employmentTypes: z.array(z.string()).default(["Full-time", "Contract"]),
  postedWithinHours: z.number().int().positive().default(48),
  searchKeywords: z.array(z.string()).default([]),
  excludedKeywords: z.array(z.string()).default([]),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  seniority: z.array(z.string()).default([]),
  /** On-site is the default; remote only when the person chose it. */
  remoteRequired: z.boolean().default(false),
  remotePolicy: z
    .enum(["remote_ok_required", "remote_preferred", "any"])
    .default("any"),
  priorityIndustries: z.array(z.string()).default([]),
  avoidIndustries: z.array(z.string()).default([]),
  salary: z
    .object({
      min: z.number().nullable().optional(),
      currency: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  /** Public Greenhouse / Lever / Ashby board URLs for direct public collection. */
  atsBoardUrls: z.array(z.string()).default([]),
  sourcesEnabled: z.array(JobSourceSchema).default(["infostud", "linkedin"]),
  maxResultsPerQuery: z.number().int().positive().default(12),
  maxDailyRawJobs: z.number().int().positive().default(80),
  /** Hard Apify spend cap — keep ≤ $0.50/day for MVP mix. */
  maxDailyApifyUsd: z.number().positive().default(0.5),
});

export type JobSearchParams = z.infer<typeof JobSearchParamsSchema>;

export const SearchProfileLlmSchema = JobSearchParamsSchema.extend({
  rationale: z.array(z.string()).default([]),
});

export type SearchProfileLlm = z.infer<typeof SearchProfileLlmSchema>;

/**
 * No occupation assumptions: titles, keywords and boards all come from the
 * survey and profile. (Not valid on its own — targetTitles must be filled.)
 */
export const EMPTY_SEARCH_PARAMS: JobSearchParams = {
  targetTitles: [],
  titleSynonyms: [],
  excludedTitles: [],
  locations: [HOME_MARKET],
  employmentTypes: ["Full-time"],
  postedWithinHours: 168,
  searchKeywords: [],
  excludedKeywords: [],
  requiredSkills: [],
  preferredSkills: [],
  seniority: [],
  remoteRequired: false,
  remotePolicy: "any",
  priorityIndustries: [],
  avoidIndustries: [],
  atsBoardUrls: [],
  sourcesEnabled: ["infostud", "linkedin"],
  maxResultsPerQuery: 12,
  maxDailyRawJobs: 80,
  maxDailyApifyUsd: 0.5,
};

/** Default sources for new search profiles (quality/$ mix under $0.50/day). */
export const DEFAULT_SOURCES_ENABLED: JobSource[] = [
  ...EMPTY_SEARCH_PARAMS.sourcesEnabled,
];

export function parseJobSearchParams(json: string): JobSearchParams {
  return normalizeCollectorParams(
    JobSearchParamsSchema.parse(JSON.parse(json || "{}")),
  );
}

const WORK_MODE_AS_EMPLOYMENT = /^(remote|hybrid|on[- ]?site|onsite|wfh|work from home)$/i;

/**
 * Preserve explicitly selected sources while normalizing legacy numeric defaults.
 * - Migrates old numeric defaults (1.5 / 100 / 15) → (0.5 / 80 / 12)
 * - Hard-caps Apify spend at 0.5 so Collect never plans above the MVP budget
 * - Moves mistaken work-mode values ("Remote") out of employmentTypes
 */
export function normalizeCollectorParams(params: JobSearchParams): JobSearchParams {
  const sources = new Set(params.sourcesEnabled);
  let maxDailyApifyUsd = params.maxDailyApifyUsd;
  if (maxDailyApifyUsd === 1.5 || maxDailyApifyUsd > 0.5) {
    maxDailyApifyUsd = 0.5;
  }

  let maxDailyRawJobs = params.maxDailyRawJobs;
  if (maxDailyRawJobs === 100) maxDailyRawJobs = 80;

  let maxResultsPerQuery = params.maxResultsPerQuery;
  if (maxResultsPerQuery === 15) maxResultsPerQuery = 12;

  // LLM/UI sometimes puts "Remote" in employmentTypes — that drops every Full-time job.
  const workModes = params.employmentTypes.filter((t) =>
    WORK_MODE_AS_EMPLOYMENT.test(t.trim()),
  );
  let employmentTypes = params.employmentTypes.filter(
    (t) => !WORK_MODE_AS_EMPLOYMENT.test(t.trim()),
  );
  if (employmentTypes.length === 0) {
    employmentTypes = ["Full-time", "Contract"];
  }

  let remoteRequired = params.remoteRequired;
  let remotePolicy = params.remotePolicy;
  if (workModes.some((m) => /remote|wfh|work from home/i.test(m))) {
    remoteRequired = true;
    if (remotePolicy === "any") remotePolicy = "remote_ok_required";
  }

  // A bare "on-site" / "hybrid" keyword matches almost every description; the remote rule covers it.
  const excludedKeywords = params.excludedKeywords.filter(
    (k) => !WORK_MODE_AS_EMPLOYMENT.test(k.trim()) && !/^(office|in[- ]office)$/i.test(k.trim()),
  );
  const atsBoardUrls = [
    ...new Set(params.atsBoardUrls.map((url) => MOVED_ATS_BOARDS[url.replace(/\/+$/, "")] ?? url)),
  ];

  // Searches saved before occupations existed: recover synonyms and family
  // from the catalog so title matching keeps working.
  const known = params.targetTitles
    .map((title) => findOccupation(title))
    .filter((occ) => occ != null);
  const titleSynonyms = params.titleSynonyms.length
    ? params.titleSynonyms
    : uniqueCaseless(known.flatMap(occupationSearchTerms)).slice(0, 16);

  return {
    ...params,
    occupationFamily: params.occupationFamily ?? known[0]?.family,
    occupationId: params.occupationId ?? known[0]?.id,
    titleSynonyms,
    excludedKeywords,
    atsBoardUrls,
    employmentTypes,
    remoteRequired,
    remotePolicy,
    sourcesEnabled: [...sources],
    maxDailyApifyUsd,
    maxDailyRawJobs,
    maxResultsPerQuery,
  };
}
