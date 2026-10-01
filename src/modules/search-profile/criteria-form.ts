import { linesToList, listToLines } from "@/lib/text-lines";
import type { JobSearchParams } from "./schemas";

/**
 * The part of the search criteria the Search page edits, as form text.
 * Everything else (sources, skills, remote rules…) is kept from the
 * criteria being edited.
 */
export type CriteriaFormValues = {
  titles: string;
  excluded: string;
  locations: string;
  keywords: string;
  excludedKw: string;
  boards: string;
  postedWithinDays: string;
  maxRaw: string;
  maxApify: string;
};

export const DEFAULT_POSTED_WITHIN_HOURS = 48;

function hoursToDays(hours: number) {
  return Math.max(1, Math.round(hours / 24));
}

function daysToHours(days: number) {
  return Math.max(1, Math.round(days)) * 24;
}

export function paramsToFormValues(params: JobSearchParams | undefined): CriteriaFormValues {
  return {
    titles: listToLines(params?.targetTitles),
    excluded: listToLines(params?.excludedTitles),
    locations: listToLines(params?.locations),
    keywords: listToLines(params?.searchKeywords),
    excludedKw: listToLines(params?.excludedKeywords),
    boards: listToLines(params?.atsBoardUrls),
    postedWithinDays: String(hoursToDays(params?.postedWithinHours ?? DEFAULT_POSTED_WITHIN_HOURS)),
    maxRaw: String(params?.maxDailyRawJobs ?? 80),
    maxApify: String(params?.maxDailyApifyUsd ?? 0.5),
  };
}

/** Applies the form to `base`; blank or invalid numbers fall back to the defaults. */
export function formValuesToParams(
  values: CriteriaFormValues,
  base: JobSearchParams | undefined,
): JobSearchParams {
  const days = Number(values.postedWithinDays);
  return {
    occupationFamily: base?.occupationFamily,
    occupationId: base?.occupationId,
    targetTitles: linesToList(values.titles),
    titleSynonyms: base?.titleSynonyms ?? [],
    excludedTitles: linesToList(values.excluded),
    locations: linesToList(values.locations),
    employmentTypes: base?.employmentTypes ?? ["Full-time", "Contract"],
    postedWithinHours: days ? daysToHours(days) : DEFAULT_POSTED_WITHIN_HOURS,
    searchKeywords: linesToList(values.keywords),
    excludedKeywords: linesToList(values.excludedKw),
    requiredSkills: base?.requiredSkills ?? [],
    preferredSkills: base?.preferredSkills ?? [],
    seniority: base?.seniority ?? [],
    remoteRequired: base?.remoteRequired ?? false,
    remotePolicy: base?.remotePolicy ?? "any",
    priorityIndustries: base?.priorityIndustries ?? [],
    avoidIndustries: base?.avoidIndustries ?? [],
    salary: base?.salary,
    atsBoardUrls: linesToList(values.boards),
    sourcesEnabled: base?.sourcesEnabled ?? ["infostud", "linkedin"],
    maxResultsPerQuery: base?.maxResultsPerQuery ?? 12,
    maxDailyRawJobs: Number(values.maxRaw) || 80,
    maxDailyApifyUsd: Number(values.maxApify) || 0.5,
  };
}
