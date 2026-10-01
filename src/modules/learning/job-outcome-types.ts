/**
 * Job decision and outcome vocabulary, shared by the server and the UI.
 * Pure values only, so client components can import it.
 */

export const JOB_REJECT_REASONS = [
  "Wrong title",
  "Wrong seniority",
  "Wrong location / remote",
  "Wrong industry",
  "Comp too low",
  "Company type mismatch",
  "Already applied elsewhere",
  "Other",
] as const;

export type JobRejectReason = (typeof JOB_REJECT_REASONS)[number];

/** What happened after the user applied. `none` means nothing recorded yet. */
export const JOB_OUTCOMES = [
  "none",
  "no_response",
  "recruiter_response",
  "interview",
  "rejected",
  "offer",
  "accepted",
] as const;

export type JobOutcome = (typeof JOB_OUTCOMES)[number];

/** An outcome the user can record (anything but `none`). */
export type RecordedJobOutcome = Exclude<JobOutcome, "none">;

export function isRecordedJobOutcome(value: string): value is RecordedJobOutcome {
  return value !== "none" && (JOB_OUTCOMES as readonly string[]).includes(value);
}

export type JobOutcomeEventType =
  | "viewed"
  | "saved"
  | "interested"
  | "rejected"
  | "applied"
  | "recruiter_response"
  | "interview"
  | "offer"
  | "accepted"
  | "no_response"
  | "rejected_after_apply";
