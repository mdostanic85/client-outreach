import type { SearchActivity, SearchLiveStats } from "@/modules/search-experience/stages";

/** High-level steps shown in the search experience (jobs mode). */
export type JobSearchStepId = "collect" | "filter" | "evaluate" | "publish";

export type JobSearchProgress = {
  stepId: JobSearchStepId;
  /** 0–100 */
  percent: number;
  /** Short step title for the checklist */
  label: string;
  /** What is happening right now */
  detail?: string;
  /** Structured counters — only real pipeline values */
  stats?: SearchLiveStats;
  /** A finished unit of work to append to the activity feed. */
  activity?: SearchActivity;
};

export type JobSearchProgressCallback = (
  progress: JobSearchProgress,
) => void | Promise<void>;

export const JOB_SEARCH_STEP_LABELS: Record<JobSearchStepId, string> = {
  collect: "Scanning job boards",
  filter: "Filtering by your criteria",
  evaluate: "Scoring strong matches",
  publish: "Building today’s list",
};

/** Collect phase owns 0–55%; filter 56–62%; evaluate 63–92%; publish 93–100%. */
export function collectPercent(done: number, total: number): number {
  if (total <= 0) return 55;
  return Math.min(55, Math.round((done / total) * 55));
}

export function evaluatePercent(done: number, total: number): number {
  if (total <= 0) return 92;
  return Math.min(92, 63 + Math.round((done / total) * 29));
}

export function progressFor(
  stepId: JobSearchStepId,
  percent: number,
  detail?: string,
  stats?: SearchLiveStats,
  activity?: SearchActivity,
): JobSearchProgress {
  return {
    stepId,
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    label: JOB_SEARCH_STEP_LABELS[stepId],
    detail,
    stats,
    activity,
  };
}

export const SOURCE_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  linkedin: "LinkedIn",
  helloworld: "HelloWorld",
  infostud: "Infostud",
  poslovi: "Poslovi.rs",
  joberty: "Joberty",
  nsz: "NSZ",
  teamtailor: "Teamtailor",
  workable: "Workable",
  recruitee: "Recruitee",
  smartrecruiters: "SmartRecruiters",
  personio: "Personio",
  remotive: "Remotive",
  arbeitnow: "Arbeitnow",
  remoteok: "Remote OK",
  himalayas: "Himalayas",
  jobicy: "Jobicy",
  weworkremotely: "We Work Remotely",
  workingnomads: "Working Nomads",
  apify: "ATS boards",
};
