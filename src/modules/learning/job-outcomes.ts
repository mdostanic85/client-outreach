import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobOutcomeEvents, jobs } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";

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

export type JobOutcome =
  | "none"
  | "no_response"
  | "recruiter_response"
  | "interview"
  | "rejected"
  | "offer"
  | "accepted";

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

export function recordJobOutcomeEvent(
  jobId: string,
  type: JobOutcomeEventType,
  payload: Record<string, unknown> = {},
) {
  const db = getDb();
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) throw new Error("Job not found");

  db.insert(jobOutcomeEvents)
    .values({
      id: newId("joe"),
      jobId,
      type,
      strategyVersion: job.searchProfileVersion,
      payloadJson: JSON.stringify(payload),
      createdAt: nowIso(),
    })
    .run();
}

export function setJobOutcome(
  jobId: string,
  outcome: Exclude<JobOutcome, "none">,
  note?: string,
) {
  const db = getDb();
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) throw new Error("Job not found");
  if (job.triageState !== "applied" && job.triageState !== "interested") {
    throw new Error("Mark the job as applied before recording an outcome");
  }

  const now = nowIso();
  const eventType: JobOutcomeEventType =
    outcome === "rejected" ? "rejected_after_apply" : outcome;

  db.update(jobs)
    .set({
      outcome,
      outcomeAt: now,
      outcomeNote: note?.trim() || null,
      updatedAt: now,
      ...(job.triageState !== "applied"
        ? { triageState: "applied", appliedAt: job.appliedAt ?? now }
        : {}),
    })
    .where(eq(jobs.id, jobId))
    .run();

  recordJobOutcomeEvent(jobId, eventType, { note: note?.trim() || null });
}

export function listAppliedJobs(limit = 40) {
  const db = getDb();
  return db
    .select()
    .from(jobs)
    .all()
    .filter((j) => j.triageState === "applied")
    .sort((a, b) =>
      (b.appliedAt ?? b.updatedAt).localeCompare(a.appliedAt ?? a.updatedAt),
    )
    .slice(0, limit);
}
