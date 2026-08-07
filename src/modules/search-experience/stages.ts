/** Human-readable search stages shared by jobs + companies experiences. */

export const SEARCH_UX_STAGES = [
  {
    id: "understand_profile",
    label: "Understanding your profile",
    jobsHint: "Reading skills, seniority, and preferences",
    companiesHint: "Loading your targeting preferences",
  },
  {
    id: "build_strategy",
    label: "Building your search strategy",
    jobsHint: "Titles, locations, and filters from your criteria",
    companiesHint: "Industries, regions, and fit signals",
  },
  {
    id: "search_sources",
    label: "Searching relevant sources",
    jobsHint: "Job boards and ATS listings",
    companiesHint: "Company and hiring sources",
  },
  {
    id: "review_matches",
    label: "Reviewing potential matches",
    jobsHint: "Reading roles against your profile",
    companiesHint: "Qualifying companies for outreach",
  },
  {
    id: "remove_weak",
    label: "Removing weak and duplicate results",
    jobsHint: "Dropping poor fits and duplicates",
    companiesHint: "Filtering weak and duplicate companies",
  },
  {
    id: "rank",
    label: "Ranking the best opportunities",
    jobsHint: "Scoring and ordering strong fits",
    companiesHint: "Scoring research and outreach fit",
  },
  {
    id: "prepare",
    label: "Preparing your recommendations",
    jobsHint: "Building today’s shortlist",
    companiesHint: "Building today’s company list",
  },
] as const;

export type SearchUxStageId = (typeof SEARCH_UX_STAGES)[number]["id"];

export type SearchLiveStats = {
  sourcesActive?: string[];
  reviewed?: number;
  removed?: number;
  promising?: number;
  regionOrCategory?: string;
};

/** Map jobs pipeline step → UX stage. */
export function uxStageFromJobStep(
  stepId: string,
  percent: number,
): SearchUxStageId {
  if (stepId === "collect") {
    if (percent < 4) return "understand_profile";
    if (percent < 10) return "build_strategy";
    return "search_sources";
  }
  if (stepId === "filter") return "remove_weak";
  if (stepId === "evaluate") {
    return percent < 78 ? "review_matches" : "rank";
  }
  if (stepId === "publish") return "prepare";
  return "search_sources";
}

/** Map company worker step → UX stage. */
export function uxStageFromCompanyStep(
  stepId: string,
  percent: number,
): SearchUxStageId {
  if (stepId === "discover") {
    if (percent < 8) return "understand_profile";
    if (percent < 16) return "build_strategy";
    return "search_sources";
  }
  if (stepId === "triage") {
    return percent < 45 ? "review_matches" : "remove_weak";
  }
  if (stepId === "research") return "rank";
  if (stepId === "rank" || stepId === "publish") return "prepare";
  return "search_sources";
}

export function stageIndex(stageId: SearchUxStageId): number {
  return SEARCH_UX_STAGES.findIndex((s) => s.id === stageId);
}
