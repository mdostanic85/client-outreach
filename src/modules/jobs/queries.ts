import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, jobMatches, jobs, settings } from "@/db/schema";
import { nowIso } from "@/lib/ids";

export type JobTriageState =
  | "discovered"
  | "published"
  | "interested"
  | "rejected"
  | "saved"
  | "applied";

export type DailyJobRow = {
  job: typeof jobs.$inferSelect;
  company: typeof companies.$inferSelect | null;
  match: typeof jobMatches.$inferSelect | null;
  matchingReasons: string[];
  concerns: string[];
};

export function listDailyJobs(limit?: number): DailyJobRow[] {
  const db = getDb();
  const setting = db.select().from(settings).all()[0];
  const cap = limit ?? setting?.dailyJobCount ?? 20;

  const published = db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "active"),
        isNotNull(jobs.publishedAt),
        inArray(jobs.triageState, ["published", "saved", "discovered"]),
      ),
    )
    .orderBy(desc(jobs.publishedAt))
    .all()
    .filter((j) => j.triageState !== "rejected" && j.triageState !== "applied")
    .slice(0, cap);

  // Prefer jobs that are published today-ish; also include saved
  const rows: DailyJobRow[] = [];
  for (const job of published) {
    const company = job.companyId
      ? db.select().from(companies).where(eq(companies.id, job.companyId)).get() ??
        null
      : null;
    const match =
      db
        .select()
        .from(jobMatches)
        .where(eq(jobMatches.jobId, job.id))
        .all()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

    let matchingReasons: string[] = [];
    let concerns: string[] = [];
    if (match) {
      try {
        matchingReasons = JSON.parse(match.matchingReasonsJson) as string[];
        concerns = JSON.parse(match.concernsJson) as string[];
      } catch {
        /* ignore */
      }
    }

    rows.push({ job, company, match, matchingReasons, concerns });
  }

  rows.sort(
    (a, b) => (b.match?.matchScore ?? 0) - (a.match?.matchScore ?? 0),
  );
  return rows;
}

export function getJobDetail(jobId: string): DailyJobRow | null {
  const db = getDb();
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) return null;
  const company = job.companyId
    ? db.select().from(companies).where(eq(companies.id, job.companyId)).get() ??
      null
    : null;
  const match =
    db
      .select()
      .from(jobMatches)
      .where(eq(jobMatches.jobId, jobId))
      .all()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  let matchingReasons: string[] = [];
  let concerns: string[] = [];
  if (match) {
    try {
      matchingReasons = JSON.parse(match.matchingReasonsJson) as string[];
      concerns = JSON.parse(match.concernsJson) as string[];
    } catch {
      /* ignore */
    }
  }
  return { job, company, match, matchingReasons, concerns };
}

export function setJobTriageState(
  jobId: string,
  state: JobTriageState,
  rejectReason?: string,
) {
  const db = getDb();
  const row = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!row) throw new Error("Job not found");
  db.update(jobs)
    .set({
      triageState: state,
      rejectReason: state === "rejected" ? rejectReason?.trim() || null : null,
      updatedAt: nowIso(),
    })
    .where(eq(jobs.id, jobId))
    .run();
}

export function interestedJob(jobId: string) {
  setJobTriageState(jobId, "interested");
}

export function rejectJob(jobId: string, reason: string) {
  if (!reason.trim()) throw new Error("Reject reason required");
  setJobTriageState(jobId, "rejected", reason);
}

export function saveJobForLater(jobId: string) {
  setJobTriageState(jobId, "saved");
}

export function markJobApplied(jobId: string) {
  setJobTriageState(jobId, "applied");
}

export function setTodayMode(mode: "jobs" | "clients") {
  const db = getDb();
  const row = db.select().from(settings).all()[0];
  if (!row) throw new Error("Settings missing");
  db.update(settings)
    .set({ todayMode: mode, updatedAt: nowIso() })
    .where(eq(settings.id, row.id))
    .run();
}

export function getTodayMode(): "jobs" | "clients" {
  const row = getDb().select().from(settings).all()[0];
  return row?.todayMode === "clients" ? "clients" : "jobs";
}
