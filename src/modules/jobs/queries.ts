import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  collectorRuns,
  companies,
  jobMatches,
  jobs,
  researchBriefs,
  settings,
} from "@/db/schema";
import { nowIso } from "@/lib/ids";
import {
  emptyCompanySnapshot,
  formatSalaryDisplay,
  HIRING_LOOKBACK_DAYS,
  type CompanySnapshot,
} from "@/modules/jobs/company-snapshot";
import { recordJobOutcomeEvent } from "@/modules/learning/job-outcomes";
import {
  parseMatchExtrasFromScoreJson,
  resolveRemoteFit,
  type RemoteFit,
} from "@/modules/matching/remote-fit";
import type { MatchDimensions } from "@/modules/matching/score";
import { WORTH_A_LOOK_LIMIT } from "@/modules/matching/tiers";
import type { ResearchAndScore } from "@/modules/research/schemas";
import { getApprovedSearchProfile } from "@/modules/search-profile/queries";
import { owned } from "@/modules/auth/current-user";
import { getUserSettings } from "@/modules/settings/user-settings";

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
  matchDimensions: MatchDimensions | null;
  remoteRequired: boolean;
  companySnapshot: CompanySnapshot;
};

function lookbackIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function loadCompanySnapshotContext(companyIds: string[]) {
  const db = getDb();
  const unique = [...new Set(companyIds)];
  const lookbackSince = lookbackIso(HIRING_LOOKBACK_DAYS);
  if (unique.length === 0) {
    return {
      summaryByCompany: new Map<string, string>(),
      risksByCompany: new Map<string, string[]>(),
      openingsByCompany: new Map<string, number>(),
      lookbackSince,
    };
  }

  const [briefRows, recentJobs] = await Promise.all([
    db
      .select()
      .from(researchBriefs)
      .where(inArray(researchBriefs.companyId, unique))
      .orderBy(desc(researchBriefs.createdAt)),
    db
      .select({
        companyId: jobs.companyId,
        id: jobs.id,
      })
      .from(jobs)
      .where(
        and(await owned(jobs),
          inArray(jobs.companyId, unique),
          eq(jobs.status, "active"),
          gte(jobs.createdAt, lookbackSince),
        ),
      ),
  ]);

  const summaryByCompany = new Map<string, string>();
  const risksByCompany = new Map<string, string[]>();
  for (const brief of briefRows) {
    if (summaryByCompany.has(brief.companyId)) continue;
    try {
      const result = JSON.parse(brief.resultJson) as ResearchAndScore;
      if (result.companySummary?.trim()) {
        summaryByCompany.set(brief.companyId, result.companySummary.trim());
      }
      risksByCompany.set(
        brief.companyId,
        (result.risksAndUnknowns ?? []).filter(Boolean).slice(0, 4),
      );
    } catch {
      /* ignore malformed brief */
    }
  }

  const openingsByCompany = new Map<string, number>();
  for (const row of recentJobs) {
    if (!row.companyId) continue;
    openingsByCompany.set(
      row.companyId,
      (openingsByCompany.get(row.companyId) ?? 0) + 1,
    );
  }

  return {
    summaryByCompany,
    risksByCompany,
    openingsByCompany,
    lookbackSince,
  };
}

function buildCompanySnapshot(input: {
  job: typeof jobs.$inferSelect;
  company: typeof companies.$inferSelect | null;
  summaryByCompany: Map<string, string>;
  risksByCompany: Map<string, string[]>;
  openingsByCompany: Map<string, number>;
  lookbackSince: string;
}): CompanySnapshot {
  const { job, company } = input;
  const companyId = company?.id ?? job.companyId ?? null;
  const base = emptyCompanySnapshot(company?.name ?? "Unknown");
  const rawOpenings = companyId
    ? (input.openingsByCompany.get(companyId) ?? 0)
    : 0;
  const currentInWindow =
    Boolean(companyId) &&
    job.companyId === companyId &&
    job.createdAt >= input.lookbackSince;
  const relatedOpenings = currentInWindow
    ? Math.max(0, rawOpenings - 1)
    : rawOpenings;

  return {
    ...base,
    companyId,
    companyName: company?.name ?? "Unknown",
    domain: company?.domain ?? null,
    country: company?.country ?? null,
    summary: companyId ? (input.summaryByCompany.get(companyId) ?? null) : null,
    headcountBand: null,
    salaryText: formatSalaryDisplay({
      salaryText: job.salaryText,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
    }),
    employmentType: job.employmentType,
    relatedOpenings,
    hiringLookbackDays: HIRING_LOOKBACK_DAYS,
    risksAndUnknowns: companyId
      ? (input.risksByCompany.get(companyId) ?? [])
      : [],
    reputation: null,
  };
}

async function hydrateJobRows(
  jobList: (typeof jobs.$inferSelect)[],
): Promise<DailyJobRow[]> {
  const db = getDb();
  const remoteRequired =
    (await getApprovedSearchProfile())?.params.remoteRequired ?? true;

  const companyIds = jobList
    .map((j) => j.companyId)
    .filter((id): id is string => Boolean(id));

  const snapshotCtx = await loadCompanySnapshotContext(companyIds);

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
        .where(and(await owned(jobMatches), eq(jobMatches.jobId, job.id))))
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
      matchDimensions: extras.dimensions,
      remoteRequired,
      companySnapshot: buildCompanySnapshot({
        job,
        company,
        ...snapshotCtx,
      }),
    });
  }

  rows.sort(
    (a, b) => (b.match?.matchScore ?? 0) - (a.match?.matchScore ?? 0),
  );
  return rows;
}

export async function listDailyJobs(limit?: number): Promise<DailyJobRow[]> {
  const db = getDb();
  const setting = (await getUserSettings());
  // Strong cap + secondary “Worth a look” band.
  const cap = limit ?? (setting?.dailyJobCount ?? 20) + WORTH_A_LOOK_LIMIT;

  const published = (await db
    .select()
    .from(jobs)
    .where(
      and(await owned(jobs),
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

export type JobSearchStatus = {
  hasSearchProfile: boolean;
  /** Last finished collector run of any source — a proxy for the last Find jobs run. */
  lastRunAt: string | null;
  /** Published today-list roles not yet reviewed (saved/interested/rejected move out). */
  toReview: number;
};

/** Topbar status: two cheap aggregates, no row hydration. */
export async function getJobSearchStatus(hasSearchProfile: boolean): Promise<JobSearchStatus> {
  const db = getDb();
  const [myRuns, myJobs] = await Promise.all([owned(collectorRuns), owned(jobs)]);
  const [lastRun, review] = await Promise.all([
    db
      .select({ at: sql<string | null>`max(${collectorRuns.finishedAt})` })
      .from(collectorRuns)
      .where(myRuns),
    db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(
      and(
        myJobs,
        eq(jobs.status, "active"),
        isNotNull(jobs.publishedAt),
        eq(jobs.triageState, "published"),
      ),
    ),
  ]);
  return {
    hasSearchProfile,
    lastRunAt: lastRun[0]?.at ?? null,
    toReview: Number(review[0]?.count ?? 0),
  };
}

/** Roles the user marked Interested — leaves Today until applied / rejected / moved back. */
export async function listInterestedJobs(limit = 80): Promise<DailyJobRow[]> {
  const db = getDb();
  const interested = (await db
    .select()
    .from(jobs)
    .where(
      and(await owned(jobs), eq(jobs.status, "active"), eq(jobs.triageState, "interested")),
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
      and(await owned(jobs), eq(jobs.status, "active"), eq(jobs.triageState, "interested")),
    )).length;
}

export async function getJobDetail(jobId: string): Promise<DailyJobRow | null> {
  const hydrated = await hydrateJobRows(
    (await getDb().select().from(jobs).where(and(await owned(jobs), eq(jobs.id, jobId))).limit(1)),
  );
  return hydrated[0] ?? null;
}

export async function setJobTriageState(
  jobId: string,
  state: JobTriageState,
  rejectReason?: string,
) {
  const db = getDb();
  const row = (await db.select().from(jobs).where(and(await owned(jobs), eq(jobs.id, jobId))).limit(1))[0];
  if (!row) throw new Error("Job not found");
  const now = nowIso();
  await db.update(jobs)
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

export async function setTodayMode(mode: "jobs" | "clients") {
  const db = getDb();
  const row = (await getUserSettings());
  if (!row) throw new Error("Settings missing");
  await db.update(settings)
    .set({ todayMode: mode, updatedAt: nowIso() })
    .where(and(await owned(settings), eq(settings.id, row.id)));
}

export async function getTodayMode(): Promise<"jobs" | "clients"> {
  const row = (await getUserSettings());
  return row?.todayMode === "clients" ? "clients" : "jobs";
}

export async function getAdaptiveJobRanking(): Promise<boolean> {
  const row = (await getUserSettings());
  return row?.adaptiveJobRanking !== 0;
}

export async function setAdaptiveJobRanking(enabled: boolean) {
  const db = getDb();
  const row = (await getUserSettings());
  if (!row) throw new Error("Settings missing");
  await db.update(settings)
    .set({
      adaptiveJobRanking: enabled ? 1 : 0,
      updatedAt: nowIso(),
    })
    .where(and(await owned(settings), eq(settings.id, row.id)));
}

export {
  getMatchingSourcesConfig,
  getUsePortfolioInMatching,
  setMatchingSourcesConfig,
  setUsePortfolioInMatching,
} from "@/modules/profile/matching-sources";
