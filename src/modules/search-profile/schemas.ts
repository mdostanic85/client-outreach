import { z } from "zod";

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

/** Default SaaS / product-design ATS boards for direct public collection. */
export const DEFAULT_ATS_BOARD_URLS = [
  "https://boards.greenhouse.io/figma",
  "https://boards.greenhouse.io/notion",
  "https://boards.greenhouse.io/stripe",
  "https://boards.greenhouse.io/discord",
  "https://boards.greenhouse.io/webflow",
  "https://boards.greenhouse.io/intercom",
  "https://boards.greenhouse.io/airbnb",
  "https://jobs.ashbyhq.com/linear",
  "https://jobs.ashbyhq.com/ramp",
  "https://jobs.lever.co/vercel",
];

export const JobSearchParamsSchema = z.object({
  targetTitles: z.array(z.string()).min(1),
  excludedTitles: z.array(z.string()).default([]),
  locations: z.array(z.string()).min(1),
  employmentTypes: z.array(z.string()).default(["Full-time", "Contract"]),
  postedWithinHours: z.number().int().positive().default(48),
  searchKeywords: z.array(z.string()).default([]),
  excludedKeywords: z.array(z.string()).default([]),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  seniority: z.array(z.string()).default([]),
  remoteRequired: z.boolean().default(true),
  remotePolicy: z
    .enum(["remote_ok_required", "remote_preferred", "any"])
    .default("remote_ok_required"),
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
  atsBoardUrls: z.array(z.string()).default([...DEFAULT_ATS_BOARD_URLS]),
  sourcesEnabled: z
    .array(JobSourceSchema)
    .default([
      "remotive",
      "arbeitnow",
      "greenhouse",
      "lever",
      "ashby",
    ]),
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

export const EMPTY_SEARCH_PARAMS: JobSearchParams = {
  targetTitles: ["Senior Product Designer", "Product Designer"],
  excludedTitles: [
    "Graphic Designer",
    "Product Manager",
    "Junior Designer",
    "Intern",
  ],
  locations: ["Remote", "Europe", "EMEA", "Serbia"],
  employmentTypes: ["Full-time", "Contract"],
  postedWithinHours: 48,
  searchKeywords: ["product design", "Figma", "design systems"],
  excludedKeywords: [
    "US residents only",
    "must be based in the US",
    "no remote",
    "internship",
    "relocation required",
  ],
  requiredSkills: [],
  preferredSkills: [],
  seniority: ["senior", "lead"],
  remoteRequired: true,
  remotePolicy: "remote_ok_required",
  priorityIndustries: [],
  avoidIndustries: [],
  atsBoardUrls: [...DEFAULT_ATS_BOARD_URLS],
  sourcesEnabled: [
    "remotive",
    "arbeitnow",
    "greenhouse",
    "lever",
    "ashby",
  ],
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

  return {
    ...params,
    employmentTypes,
    remoteRequired,
    remotePolicy,
    sourcesEnabled: [...sources],
    maxDailyApifyUsd,
    maxDailyRawJobs,
    maxResultsPerQuery,
  };
}
