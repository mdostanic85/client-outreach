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

async function hydrateJobRows(
  jobList: (typeof jobs.$inferSelect)[],
): Promise<DailyJobRow[]> {
  const db = getDb();
  const remoteRequired =
    (await getApprovedSearchProfile())?.params.remoteRequired ?? true;
  const rows: DailyJobRow[] = [];
  for (const job of jobList) {
    const company = job.companyId
      ? (await db.select().from(companies).where(eq(companies.id, job.companyId)).limit(1))[0] ??
        null
      : null;
    const match =
      (await db
        .select()
        .from(jobMatches)
        .where(eq(jobMatches.jobId, job.id)))
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

export async function listDailyJobs(limit?: number): Promise<DailyJobRow[]> {
  const db = getDb();
  const setting = (await db.select().from(settings).limit(1))[0];
  // Strong cap + secondary “Worth a look” band.
  const cap = limit ?? (setting?.dailyJobCount ?? 20) + WORTH_A_LOOK_LIMIT;

  const published = (await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "active"),
        isNotNull(jobs.publishedAt),
        inArray(jobs.triageState, ["published", "saved", "discovered"]),
      ),
    )
    .orderBy(desc(jobs.publishedAt)))
    .filter((j) => j.triageState !== "rejected" && j.triageState !== "applied")
    .slice(0, cap);

  return hydrateJobRows(published);
}

/** Roles the user marked Interested — leaves Today until applied / rejected / moved back. */
export async function listInterestedJobs(limit = 80): Promise<DailyJobRow[]> {
  const db = getDb();
  const interested = (await db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.status, "active"), eq(jobs.triageState, "interested")),
    )
    .orderBy(desc(jobs.updatedAt)))
    .slice(0, limit);

  return hydrateJobRows(interested);
}

export async function countInterestedJobs(): Promise<number> {
  return (await getDb()
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.status, "active"), eq(jobs.triageState, "interested")),
    )).length;
}

export async function getJobDetail(jobId: string): Promise<DailyJobRow | null> {
  const db = getDb();
  const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!job) return null;
  const company = job.companyId
    ? (await db.select().from(companies).where(eq(companies.id, job.companyId)).limit(1))[0] ??
      null
    : null;
  const match =
    (await db
      .select()
      .from(jobMatches)
      .where(eq(jobMatches.jobId, jobId)))
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
    (await getApprovedSearchProfile())?.params.remoteRequired ?? true;
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

export async function setJobTriageState(
  jobId: string,
  state: JobTriageState,
  rejectReason?: string,
) {
  const db = getDb();
  const row = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
  if (!row) throw new Error("Job not found");
  const now = nowIso();
  await db.update(jobs)
    .set({
      triageState: state,
      rejectReason: state === "rejected" ? rejectReason?.trim() || null : null,
      updatedAt: now,
      ...(state === "applied" ? { appliedAt: row.appliedAt ?? now } : {}),
    })
    .where(eq(jobs.id, jobId));
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

export async function setTodayMode(mode: "jobs" | "clients") {
  const db = getDb();
  const row = (await db.select().from(settings).limit(1))[0];
  if (!row) throw new Error("Settings missing");
  await db.update(settings)
    .set({ todayMode: mode, updatedAt: nowIso() })
    .where(eq(settings.id, row.id));
}

export async function getTodayMode(): Promise<"jobs" | "clients"> {
  const row = (await getDb().select().from(settings).limit(1))[0];
  return row?.todayMode === "clients" ? "clients" : "jobs";
}

export async function getAdaptiveJobRanking(): Promise<boolean> {
  const row = (await getDb().select().from(settings).limit(1))[0];
  return row?.adaptiveJobRanking !== 0;
}

export async function setAdaptiveJobRanking(enabled: boolean) {
  const db = getDb();
  const row = (await db.select().from(settings).limit(1))[0];
  if (!row) throw new Error("Settings missing");
  await db.update(settings)
    .set({
      adaptiveJobRanking: enabled ? 1 : 0,
      updatedAt: nowIso(),
    })
    .where(eq(settings.id, row.id));
}

export {
  getMatchingSourcesConfig,
  getUsePortfolioInMatching,
  setMatchingSourcesConfig,
  setUsePortfolioInMatching,
} from "@/modules/profile/matching-sources";
