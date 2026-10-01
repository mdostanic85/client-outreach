import type { SearchLiveStats } from "@/modules/search-experience/stages";

/** Stages streamed for Find Companies. */
export type CompanySearchStepId =
  | "discover"
  | "triage"
  | "research"
  | "rank"
  | "publish";

export type CompanySearchProgress = {
  stepId: CompanySearchStepId;
  percent: number;
  label: string;
  detail?: string;
  stats?: SearchLiveStats;
};

export type CompanySearchProgressCallback = (
  progress: CompanySearchProgress,
) => void | Promise<void>;

export const COMPANY_SEARCH_STEP_LABELS: Record<CompanySearchStepId, string> = {
  discover: "Scanning company sources",
  triage: "Qualifying outreach targets",
  research: "Researching fit signals",
  rank: "Ranking companies",
  publish: "Building today’s list",
};

export function companyProgressFor(
  stepId: CompanySearchStepId,
  percent: number,
  detail?: string,
  stats?: SearchLiveStats,
): CompanySearchProgress {
  return {
    stepId,
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    label: COMPANY_SEARCH_STEP_LABELS[stepId],
    detail,
    stats,
  };
}

/** Summary the company pipeline sends when Find companies finishes. */
export type CompanyPipelineStats = {
  published?: number;
  rawCandidates?: number;
  deterministicallyRemoved?: number;
  triageRejected?: number;
  researched?: number;
  sourceErrors?: unknown[];
  skipped?: string;
};
