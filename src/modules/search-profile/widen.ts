import type { JobSearchParams } from "./schemas";

/**
 * More material about a person (a CV, a website, LinkedIn) should find more
 * jobs, never fewer. These rules keep regenerated search criteria at least as
 * wide as the ones the person already approved, and keep anything that was
 * only inferred from documents out of the hard filters.
 */

/** Titles that get their own board queries. More titles widen title matching instead. */
export const MAX_TARGET_TITLES = 5;
/** Synonyms only widen title matching and regional search terms; they cost no queries. */
export const MAX_TITLE_SYNONYMS = 24;
export const MAX_LOCATIONS = 5;

function uniqueCaseless(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Titles beyond the query budget are not dropped: they move to synonyms, so
 * postings with those titles still pass the title filter.
 */
export function spreadTitles(
  titles: readonly string[],
  synonyms: readonly string[],
): { targetTitles: string[]; titleSynonyms: string[] } {
  const all = uniqueCaseless(titles);
  const targetTitles = all.slice(0, MAX_TARGET_TITLES);
  const targetKeys = new Set(targetTitles.map((t) => t.trim().toLowerCase()));
  const titleSynonyms = uniqueCaseless([...all.slice(MAX_TARGET_TITLES), ...synonyms])
    .filter((s) => !targetKeys.has(s.trim().toLowerCase()))
    .slice(0, MAX_TITLE_SYNONYMS);
  return { targetTitles, titleSynonyms };
}

/**
 * Filters a person chooses (the survey, or editing criteria) are hard. A
 * generator reading a CV or website must not invent them: "Remote" in a CV
 * header becomes a preference for remote work, not a ban on on-site jobs.
 */
export function softenInferredFilters(
  params: JobSearchParams,
  explicit: { remoteOnly?: boolean },
): JobSearchParams {
  if (explicit.remoteOnly !== undefined) return params;
  if (!params.remoteRequired && params.remotePolicy !== "remote_ok_required") return params;
  return { ...params, remoteRequired: false, remotePolicy: "remote_preferred" };
}

/**
 * Regenerated criteria (after a new profile, a weekly insight, a manual
 * regenerate) start from what the person approved and only add to it:
 *
 * - titles, synonyms, places, employment types, sources, boards and scoring
 *   hints are combined;
 * - exclusions, seniority, the remote requirement and the paid-source budget
 *   stay exactly as approved, since they are the person's own filters;
 * - search limits never shrink.
 *
 * The person can still narrow anything by editing the criteria themselves.
 */
export function widenFromApproved(
  next: JobSearchParams,
  approved: JobSearchParams | null | undefined,
): JobSearchParams {
  if (!approved) return next;
  const titles = spreadTitles(
    [...approved.targetTitles, ...next.targetTitles],
    [...approved.titleSynonyms, ...next.titleSynonyms],
  );
  return {
    ...next,
    occupationFamily: approved.occupationFamily ?? next.occupationFamily,
    occupationId: approved.occupationId ?? next.occupationId,
    ...titles,
    locations: uniqueCaseless([...approved.locations, ...next.locations]).slice(0, MAX_LOCATIONS),
    employmentTypes: uniqueCaseless([...approved.employmentTypes, ...next.employmentTypes]),
    searchKeywords: uniqueCaseless([...approved.searchKeywords, ...next.searchKeywords]),
    requiredSkills: uniqueCaseless([...approved.requiredSkills, ...next.requiredSkills]),
    preferredSkills: uniqueCaseless([...approved.preferredSkills, ...next.preferredSkills]),
    priorityIndustries: uniqueCaseless([...approved.priorityIndustries, ...next.priorityIndustries]),
    atsBoardUrls: uniqueCaseless([...approved.atsBoardUrls, ...next.atsBoardUrls]),
    sourcesEnabled: [...new Set([...approved.sourcesEnabled, ...next.sourcesEnabled])],
    excludedTitles: approved.excludedTitles,
    excludedKeywords: approved.excludedKeywords,
    avoidIndustries: approved.avoidIndustries,
    seniority: approved.seniority,
    remoteRequired: approved.remoteRequired,
    remotePolicy: approved.remotePolicy,
    salary: approved.salary ?? next.salary,
    postedWithinHours: Math.max(approved.postedWithinHours, next.postedWithinHours),
    maxResultsPerQuery: Math.max(approved.maxResultsPerQuery, next.maxResultsPerQuery),
    maxDailyRawJobs: Math.max(approved.maxDailyRawJobs, next.maxDailyRawJobs),
    maxDailyApifyUsd: approved.maxDailyApifyUsd,
  };
}
