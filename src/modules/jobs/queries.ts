import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  collectorRuns,
  companies,
  jobMatches,
  jobs,
  researchBriefs,
} from "@/db/schema";
import {
  emptyCompanySnapshot,
  formatSalaryDisplay,
  HIRING_LOOKBACK_DAYS,
  type CompanySnapshot,
} from "@/modules/jobs/company-snapshot";
import {
  parseMatchExtrasFromScoreJson,
  resolveRemoteFit,
  type RemoteFit,
} from "@/modules/matching/remote-fit";
import type { MatchDimensions } from "@/modules/matching/score";
import { estimateJobScore, type JobEstimate } from "@/modules/matching/quick-estimate";
import {
  assessWorkLocation,
  homePlacesOf,
  type WorkLocationAssessment,
} from "@/modules/matching/work-location";
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
  /** Work mode and whether the person can work it from where they live. */
  work: WorkLocationAssessment;
  /** Quick score for a job the AI has not scored; null once there is a real match. */
  estimate: JobEstimate | null;
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
  if (jobList.length === 0) return [];
  const db = getDb();

  const companyIds = [
    ...new Set(
      jobList
        .map((j) => j.companyId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const jobIds = jobList.map((j) => j.id);

  // One round trip per lookup for the whole list, not per job.
  const [searchProfile, snapshotCtx, companyRows, matchRows] = await Promise.all([
    getApprovedSearchProfile(),
    loadCompanySnapshotContext(companyIds),
    companyIds.length > 0
      ? db.select().from(companies).where(inArray(companies.id, companyIds))
      : Promise.resolve([]),
    owned(jobMatches).then((mine) =>
      db
        .select()
        .from(jobMatches)
        .where(and(mine, inArray(jobMatches.jobId, jobIds))),
    ),
  ]);
  const remoteRequired = searchProfile?.params.remoteRequired ?? true;
  const homePlaces = homePlacesOf(searchProfile?.params.locations ?? []);
  const estimateCriteria = {
    targetTitles: searchProfile?.params.targetTitles ?? [],
    titleSynonyms: searchProfile?.params.titleSynonyms ?? [],
    skills: [
      ...(searchProfile?.params.requiredSkills ?? []),
      ...(searchProfile?.params.preferredSkills ?? []),
      ...(searchProfile?.params.searchKeywords ?? []),
    ],
    seniority: searchProfile?.params.seniority ?? [],
  };

  const companyById = new Map(companyRows.map((c) => [c.id, c]));
  const latestMatchByJob = new Map<string, typeof jobMatches.$inferSelect>();
  for (const match of matchRows) {
    const current = latestMatchByJob.get(match.jobId);
    if (!current || match.createdAt > current.createdAt) {
      latestMatchByJob.set(match.jobId, match);
    }
  }

  const rows: DailyJobRow[] = [];
  for (const job of jobList) {
    const company = job.companyId
      ? (companyById.get(job.companyId) ?? null)
      : null;
    const match = latestMatchByJob.get(job.id) ?? null;

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

    const work = assessWorkLocation(job, { places: homePlaces });
    rows.push({
      job,
      company,
      match,
      work,
      estimate: match ? null : estimateJobScore(job, estimateCriteria, work.home),
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
    .orderBy(desc(jobs.publishedAt))
    .limit(cap));

  return hydrateJobRows(published);
}

/** Longest the all-found list reaches back; older postings are mostly closed. */
const ALL_FOUND_LOOKBACK_DAYS = 30;
const ALL_FOUND_LIMIT = 400;

/**
 * Every job the searches found for this account (not only the published
 * picks), best score first. Jobs the AI has not scored carry an estimate.
 * Rejected jobs stay out.
 */
export async function listAllFoundJobs(limit = ALL_FOUND_LIMIT): Promise<DailyJobRow[]> {
  const found = await getDb()
    .select()
    .from(jobs)
    .where(
      and(
        await owned(jobs),
        eq(jobs.status, "active"),
        inArray(jobs.triageState, ["discovered", "published", "saved", "interested", "applied"]),
        gte(jobs.createdAt, lookbackIso(ALL_FOUND_LOOKBACK_DAYS)),
      ),
    )
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
  const rows = await hydrateJobRows(found);
  const effective = (row: DailyJobRow) => row.match?.matchScore ?? row.estimate?.score ?? 0;
  return rows.sort((a, b) => effective(b) - effective(a));
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

/** Full posting text for the job detail panel (loaded on demand, not per list row). */
export async function getJobDescription(jobId: string): Promise<string | null> {
  const row = (
    await getDb()
      .select({ description: jobs.description })
      .from(jobs)
      .where(and(await owned(jobs), eq(jobs.id, jobId)))
      .limit(1)
  )[0];
  return row ? row.description : null;
}
