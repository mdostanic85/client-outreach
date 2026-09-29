/**
 * Human-readable search stages shared by jobs + companies experiences, in the
 * order the pipelines actually run them.
 */
export const SEARCH_UX_STAGES = [
  {
    id: "search_sources",
    label: "Searching sources",
    jobsHint: "Job boards, careers pages, and LinkedIn",
    companiesHint: "Company and hiring sources",
  },
  {
    id: "filter",
    label: "Filtering results",
    jobsHint: "Dropping duplicates and off-target roles",
    companiesHint: "Dropping weak and duplicate companies",
  },
  {
    id: "score",
    label: "Scoring matches",
    jobsHint: "Reading each role against your profile",
    companiesHint: "Researching fit for outreach",
  },
  {
    id: "prepare",
    label: "Preparing your shortlist",
    jobsHint: "Ranking the strongest fits",
    companiesHint: "Ranking the strongest companies",
  },
] as const;

export type SearchUxStageId = (typeof SEARCH_UX_STAGES)[number]["id"];

export type SearchLiveStats = {
  sourcesActive?: string[];
  reviewed?: number;
  removed?: number;
  promising?: number;
  regionOrCategory?: string;
  /** Openings collected so far across all sources. */
  found?: number;
  sourcesDone?: number;
  sourcesTotal?: number;
  /** Roles queued for AI scoring; `reviewed` counts the scored ones. */
  toScore?: number;
};

/** One line in the live activity feed ("Stripe · Greenhouse · 12 found"). */
export type SearchActivity = {
  kind: "source" | "filter" | "score";
  label: string;
  meta?: string;
  value?: string;
  tone?: "strong" | "worth" | "weak" | "neutral" | "error";
};

/** Map jobs pipeline step → UX stage. */
export function uxStageFromJobStep(stepId: string): SearchUxStageId {
  if (stepId === "filter") return "filter";
  if (stepId === "evaluate") return "score";
  if (stepId === "publish") return "prepare";
  return "search_sources";
}

/** Map company worker step → UX stage. */
export function uxStageFromCompanyStep(stepId: string): SearchUxStageId {
  if (stepId === "triage") return "filter";
  if (stepId === "research") return "score";
  if (stepId === "rank" || stepId === "publish") return "prepare";
  return "search_sources";
}

export function stageIndex(stageId: SearchUxStageId): number {
  return SEARCH_UX_STAGES.findIndex((s) => s.id === stageId);
}
