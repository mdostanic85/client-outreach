import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobs } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { owned } from "@/modules/auth/current-user";
import { recordJobOutcomeEvent } from "@/modules/learning/job-outcomes";
import type { JobTriageState } from "./queries";

/**
 * The user's decisions on a job (Save / Decide later / Not interested /
 * Applied). Each decision also lands in the append-only outcome log that
 * learning reads.
 */

export async function setJobTriageState(
  jobId: string,
  state: JobTriageState,
  rejectReason?: string,
) {
  const db = getDb();
  const row = (
    await db.select().from(jobs).where(and(await owned(jobs), eq(jobs.id, jobId))).limit(1)
  )[0];
  if (!row) throw new Error("Job not found");
  const now = nowIso();
  await db
    .update(jobs)
    .set({
      triageState: state,
      rejectReason: state === "rejected" ? rejectReason?.trim() || null : null,
      updatedAt: now,
      ...(state === "applied" ? { appliedAt: row.appliedAt ?? now } : {}),
    })
    .where(and(await owned(jobs), eq(jobs.id, jobId)));
}

export async function interestedJob(jobId: string) {
  await setJobTriageState(jobId, "interested");
  await recordJobOutcomeEvent(jobId, "interested");
}

export async function rejectJob(jobId: string, reason: string) {
  if (!reason.trim()) throw new Error("Reject reason required");
  await setJobTriageState(jobId, "rejected", reason);
  await recordJobOutcomeEvent(jobId, "rejected", { reason: reason.trim() });
}

export async function saveJobForLater(jobId: string) {
  await setJobTriageState(jobId, "saved");
  await recordJobOutcomeEvent(jobId, "saved");
}

export async function markJobApplied(jobId: string) {
  await setJobTriageState(jobId, "applied");
  await recordJobOutcomeEvent(jobId, "applied");
}
