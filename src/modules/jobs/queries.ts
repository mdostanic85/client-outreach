import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, jobMatches, jobs, settings } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { recordJobOutcomeEvent } from "@/modules/learning/job-outcomes";
import {
  parseMatchExtrasFromScoreJson,
  resolveRemoteFit,
  type RemoteFit,
} from "@/modules/matching/remote-fit";
import { WORTH_A_LOOK_LIMIT } from "@/modules/matching/tiers";
import { getApprovedSearchProfile } from "@/modules/search-profile/queries";

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
  remoteFit: RemoteFit;
  mainRisk: string | null;
  missingRequirements: string[];
  remoteRequired: boolean;
};

function hydrateJobRows(jobList: (typeof jobs.$inferSelect)[]): DailyJobRow[] {
  const db = getDb();
  const remoteRequired =
    getApprovedSearchProfile()?.params.remoteRequired ?? true;
  const rows: DailyJobRow[] = [];
  for (const job of jobList) {
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

    const extras = parseMatchExtrasFromScoreJson(match?.scoreJson);
    const remoteFit = resolveRemoteFit({
      scoreJson: match?.scoreJson,
      remotePolicy: job.remotePolicy,
      location: job.location,
      concerns,
      eligibility: match?.eligibility ?? null,
      remoteRequired,
    });

    rows.push({
      job,
      company,
      match,
      matchingReasons,
      concerns,
      remoteFit,
      mainRisk: extras.mainRisk,
      missingRequirements: extras.missingRequirements,
      remoteRequired,
    });
  }

  rows.sort(
    (a, b) => (b.match?.matchScore ?? 0) - (a.match?.matchScore ?? 0),
  );
  return rows;
}

export function listDailyJobs(limit?: number): DailyJobRow[] {
  const db = getDb();
  const setting = db.select().from(settings).all()[0];
  // Strong cap + secondary “Worth a look” band.
  const cap = limit ?? (setting?.dailyJobCount ?? 20) + WORTH_A_LOOK_LIMIT;

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

  return hydrateJobRows(published);
}

/** Roles the user marked Interested — leaves Today until applied / rejected / moved back. */
export function listInterestedJobs(limit = 80): DailyJobRow[] {
  const db = getDb();
  const interested = db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.status, "active"), eq(jobs.triageState, "interested")),
    )
    .orderBy(desc(jobs.updatedAt))
    .all()
    .slice(0, limit);

  return hydrateJobRows(interested);
}

export function countInterestedJobs(): number {
  return getDb()
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.status, "active"), eq(jobs.triageState, "interested")),
    )
    .all().length;
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
  const remoteRequired =
    getApprovedSearchProfile()?.params.remoteRequired ?? true;
  const extras = parseMatchExtrasFromScoreJson(match?.scoreJson);
  const remoteFit = resolveRemoteFit({
    scoreJson: match?.scoreJson,
    remotePolicy: job.remotePolicy,
    location: job.location,
    concerns,
    eligibility: match?.eligibility ?? null,
    remoteRequired,
  });
  return {
    job,
    company,
    match,
    matchingReasons,
    concerns,
    remoteFit,
    mainRisk: extras.mainRisk,
    missingRequirements: extras.missingRequirements,
    remoteRequired,
  };
}

export function setJobTriageState(
  jobId: string,
  state: JobTriageState,
  rejectReason?: string,
) {
  const db = getDb();
  const row = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!row) throw new Error("Job not found");
  const now = nowIso();
  db.update(jobs)
    .set({
      triageState: state,
      rejectReason: state === "rejected" ? rejectReason?.trim() || null : null,
      updatedAt: now,
      ...(state === "applied" ? { appliedAt: row.appliedAt ?? now } : {}),
    })
    .where(eq(jobs.id, jobId))
    .run();
}

export function interestedJob(jobId: string) {
  setJobTriageState(jobId, "interested");
  recordJobOutcomeEvent(jobId, "interested");
}

export function rejectJob(jobId: string, reason: string) {
  if (!reason.trim()) throw new Error("Reject reason required");
  setJobTriageState(jobId, "rejected", reason);
  recordJobOutcomeEvent(jobId, "rejected", { reason: reason.trim() });
}

export function saveJobForLater(jobId: string) {
  setJobTriageState(jobId, "saved");
  recordJobOutcomeEvent(jobId, "saved");
}

export function markJobApplied(jobId: string) {
  setJobTriageState(jobId, "applied");
  recordJobOutcomeEvent(jobId, "applied");
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

export function getAdaptiveJobRanking(): boolean {
  const row = getDb().select().from(settings).all()[0];
  return row?.adaptiveJobRanking !== 0;
}

export function setAdaptiveJobRanking(enabled: boolean) {
  const db = getDb();
  const row = db.select().from(settings).all()[0];
  if (!row) throw new Error("Settings missing");
  db.update(settings)
    .set({
      adaptiveJobRanking: enabled ? 1 : 0,
      updatedAt: nowIso(),
    })
    .where(eq(settings.id, row.id))
    .run();
}

export {
  getMatchingSourcesConfig,
  getUsePortfolioInMatching,
  setMatchingSourcesConfig,
  setUsePortfolioInMatching,
} from "@/modules/profile/matching-sources";
