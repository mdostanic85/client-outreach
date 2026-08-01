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

/** Default SaaS / product-design ATS boards for focused Apify collection. */
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
  /** Public Greenhouse / Lever / Ashby board URLs for Apify ATS actor. */
  atsBoardUrls: z.array(z.string()).default([...DEFAULT_ATS_BOARD_URLS]),
  sourcesEnabled: z
    .array(JobSourceSchema)
    .default(["remotive", "arbeitnow", "greenhouse", "lever", "ashby"]),
  maxResultsPerQuery: z.number().int().positive().default(15),
  maxDailyRawJobs: z.number().int().positive().default(100),
  maxDailyApifyUsd: z.number().positive().default(1.5),
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
  sourcesEnabled: ["remotive", "arbeitnow", "greenhouse", "lever", "ashby"],
  maxResultsPerQuery: 15,
  maxDailyRawJobs: 100,
  maxDailyApifyUsd: 1.5,
};

export function parseJobSearchParams(json: string): JobSearchParams {
  return JobSearchParamsSchema.parse(JSON.parse(json || "{}"));
}
