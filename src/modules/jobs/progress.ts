/** High-level steps shown in SearchProgressModal (jobs mode). */
export type JobSearchStepId = "collect" | "filter" | "evaluate" | "publish";

export type JobSearchProgress = {
  stepId: JobSearchStepId;
  /** 0–100 */
  percent: number;
  /** Short step title for the checklist */
  label: string;
  /** What is happening right now */
  detail?: string;
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
): JobSearchProgress {
  return {
    stepId,
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    label: JOB_SEARCH_STEP_LABELS[stepId],
    detail,
  };
}
