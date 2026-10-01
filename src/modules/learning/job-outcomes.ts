import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobOutcomeEvents, jobs } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { currentUserId, owned } from "@/modules/auth/current-user";
import type { JobOutcomeEventType, RecordedJobOutcome } from "./job-outcome-types";

export async function recordJobOutcomeEvent(
  jobId: string,
  type: JobOutcomeEventType,
  payload: Record<string, unknown> = {},
) {
  const db = getDb();
  const job = (await db.select().from(jobs).where(and(await owned(jobs), eq(jobs.id, jobId))).limit(1))[0];
  if (!job) throw new Error("Job not found");

  await db.insert(jobOutcomeEvents)
    .values({
      userId: await currentUserId(),
      id: newId("joe"),
      jobId,
      type,
      strategyVersion: job.searchProfileVersion,
      payloadJson: JSON.stringify(payload),
      createdAt: nowIso(),
    });
}

export async function setJobOutcome(
  jobId: string,
  outcome: RecordedJobOutcome,
  note?: string,
) {
  const db = getDb();
  const job = (await db.select().from(jobs).where(and(await owned(jobs), eq(jobs.id, jobId))).limit(1))[0];
  if (!job) throw new Error("Job not found");
  if (job.triageState !== "applied" && job.triageState !== "interested") {
    throw new Error("Mark the job as applied before recording an outcome");
  }

  const now = nowIso();
  const eventType: JobOutcomeEventType =
    outcome === "rejected" ? "rejected_after_apply" : outcome;

  await db.update(jobs)
    .set({
      outcome,
      outcomeAt: now,
      outcomeNote: note?.trim() || null,
      updatedAt: now,
      ...(job.triageState !== "applied"
        ? { triageState: "applied", appliedAt: job.appliedAt ?? now }
        : {}),
    })
    .where(and(await owned(jobs), eq(jobs.id, jobId)));

  await recordJobOutcomeEvent(jobId, eventType, { note: note?.trim() || null });
}

export async function listAppliedJobs(limit = 40) {
  const db = getDb();
  return (await db
    .select()
    .from(jobs).where(await owned(jobs)))
    .filter((j) => j.triageState === "applied")
    .sort((a, b) =>
      (b.appliedAt ?? b.updatedAt).localeCompare(a.appliedAt ?? a.updatedAt),
    )
    .slice(0, limit);
}
