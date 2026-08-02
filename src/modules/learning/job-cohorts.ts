import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  companies,
  jobSearchProfiles,
  jobs,
  strategyCohortMetrics,
} from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";

export type SegmentStat = {
  key: string;
  label: string;
  applications: number;
  responses: number;
  interviews: number;
  responseRate: number;
  interviewRate: number;
};

export type StrategyCohort = {
  strategyVersion: number;
  status: string | null;
  hypothesisMd: string | null;
  approvedAt: string | null;
  applicationsN: number;
  responsesN: number;
  interviewsN: number;
  offersN: number;
  rejectionsN: number;
  triageLikedN: number;
  triageRejectedN: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  medianDaysToResponse: number | null;
  appsPerInterview: number | null;
  segments: {
    byTitle: SegmentStat[];
    byLocation: SegmentStat[];
    byCompany: SegmentStat[];
  };
  confidence: "low" | "directional" | "strong";
};

function rate(n: number, d: number) {
  return d > 0 ? n / d : 0;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

function daysBetween(a: string, b: string): number | null {
  const start = Date.parse(a);
  const end = Date.parse(b);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, (end - start) / (24 * 60 * 60 * 1000));
}

function confidenceFor(apps: number, interviews: number): StrategyCohort["confidence"] {
  if (apps >= 20 && interviews >= 3) return "strong";
  if (apps >= 10 || interviews >= 2) return "directional";
  return "low";
}

function buildSegment(
  rows: Array<{
    key: string;
    label: string;
    applied: boolean;
    responded: boolean;
    interviewed: boolean;
  }>,
): SegmentStat[] {
  const map = new Map<
    string,
    { label: string; applications: number; responses: number; interviews: number }
  >();
  for (const r of rows) {
    if (!r.applied) continue;
    const cur = map.get(r.key) ?? {
      label: r.label,
      applications: 0,
      responses: 0,
      interviews: 0,
    };
    cur.applications += 1;
    if (r.responded) cur.responses += 1;
    if (r.interviewed) cur.interviews += 1;
    map.set(r.key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      applications: v.applications,
      responses: v.responses,
      interviews: v.interviews,
      responseRate: rate(v.responses, v.applications),
      interviewRate: rate(v.interviews, v.applications),
    }))
    .filter((s) => s.applications >= 2)
    .sort((a, b) => b.interviewRate - a.interviewRate || b.applications - a.applications)
    .slice(0, 8);
}

export async function computeStrategyCohort(strategyVersion: number): Promise<StrategyCohort> {
  const db = getDb();
  const profile = (await db
    .select()
    .from(jobSearchProfiles)
    .where(eq(jobSearchProfiles.version, strategyVersion)))
    .sort((a, b) => (b.approvedAt ?? b.createdAt).localeCompare(a.approvedAt ?? a.createdAt))[0];

  const cohortJobs = (await db
    .select()
    .from(jobs))
    .filter((j) => j.searchProfileVersion === strategyVersion);

  const triageLikedN = cohortJobs.filter((j) =>
    ["interested", "saved", "applied"].includes(j.triageState),
  ).length;
  const triageRejectedN = cohortJobs.filter(
    (j) => j.triageState === "rejected",
  ).length;

  const applied = cohortJobs.filter((j) => j.triageState === "applied");
  const responded = applied.filter((j) =>
    ["recruiter_response", "interview", "offer", "accepted"].includes(j.outcome),
  );
  const interviewed = applied.filter((j) =>
    ["interview", "offer", "accepted"].includes(j.outcome),
  );
  const offered = applied.filter((j) =>
    ["offer", "accepted"].includes(j.outcome),
  );
  const rejected = applied.filter((j) => j.outcome === "rejected");

  const responseDays = applied
    .map((j) => {
      if (!j.appliedAt || !j.outcomeAt) return null;
      if (j.outcome === "none" || j.outcome === "no_response") return null;
      return daysBetween(j.appliedAt, j.outcomeAt);
    })
    .filter((d): d is number => d != null);

  const companyName = async (companyId: string | null) => {
    if (!companyId) return "Unknown";
    return (
      (await db.select().from(companies).where(eq(companies.id, companyId)).limit(1))[0]
        ?.name ?? "Unknown"
    );
  };

  const segmentRows = await Promise.all(
    applied.map(async (j) => {
      const respondedFlag = [
        "recruiter_response",
        "interview",
        "offer",
        "accepted",
      ].includes(j.outcome);
      const interviewedFlag = ["interview", "offer", "accepted"].includes(
        j.outcome,
      );
      return {
        titleKey: j.title.toLowerCase().trim(),
        titleLabel: j.title,
        locKey: (j.location ?? j.remotePolicy ?? "unknown").toLowerCase(),
        locLabel: j.location ?? j.remotePolicy ?? "Unknown",
        companyKey: j.companyId ?? j.title,
        companyLabel: await companyName(j.companyId),
        applied: true,
        responded: respondedFlag,
        interviewed: interviewedFlag,
      };
    }),
  );

  const applicationsN = applied.length;
  const interviewsN = interviewed.length;

  return {
    strategyVersion,
    status: profile?.status ?? null,
    hypothesisMd: profile?.hypothesisMd ?? null,
    approvedAt: profile?.approvedAt ?? null,
    applicationsN,
    responsesN: responded.length,
    interviewsN,
    offersN: offered.length,
    rejectionsN: rejected.length,
    triageLikedN,
    triageRejectedN,
    responseRate: rate(responded.length, applicationsN),
    interviewRate: rate(interviewsN, applicationsN),
    offerRate: rate(offered.length, applicationsN),
    medianDaysToResponse: median(responseDays),
    appsPerInterview:
      interviewsN > 0 ? applicationsN / interviewsN : null,
    segments: {
      byTitle: buildSegment(
        segmentRows.map((r) => ({
          key: r.titleKey,
          label: r.titleLabel,
          applied: r.applied,
          responded: r.responded,
          interviewed: r.interviewed,
        })),
      ),
      byLocation: buildSegment(
        segmentRows.map((r) => ({
          key: r.locKey,
          label: r.locLabel,
          applied: r.applied,
          responded: r.responded,
          interviewed: r.interviewed,
        })),
      ),
      byCompany: buildSegment(
        segmentRows.map((r) => ({
          key: r.companyKey,
          label: r.companyLabel,
          applied: r.applied,
          responded: r.responded,
          interviewed: r.interviewed,
        })),
      ),
    },
    confidence: confidenceFor(applicationsN, interviewsN),
  };
}

export async function persistStrategyCohort(cohort: StrategyCohort) {
  const db = getDb();
  const existing = (await db
    .select()
    .from(strategyCohortMetrics)
    .where(eq(strategyCohortMetrics.strategyVersion, cohort.strategyVersion)).limit(1))[0];

  const values = {
    applicationsN: cohort.applicationsN,
    responsesN: cohort.responsesN,
    interviewsN: cohort.interviewsN,
    offersN: cohort.offersN,
    rejectionsN: cohort.rejectionsN,
    triageLikedN: cohort.triageLikedN,
    triageRejectedN: cohort.triageRejectedN,
    responseRate: cohort.responseRate,
    interviewRate: cohort.interviewRate,
    offerRate: cohort.offerRate,
    medianDaysToResponse: cohort.medianDaysToResponse,
    segmentJson: JSON.stringify(cohort.segments),
    computedAt: nowIso(),
  };

  if (existing) {
    await db.update(strategyCohortMetrics)
      .set(values)
      .where(eq(strategyCohortMetrics.id, existing.id));
    return existing.id;
  }

  const id = newId("scm");
  await db.insert(strategyCohortMetrics)
    .values({ id, strategyVersion: cohort.strategyVersion, ...values });
  return id;
}

export async function listStrategyVersions(): Promise<StrategyCohort[]> {
  const db = getDb();
  const profiles = await db
    .select()
    .from(jobSearchProfiles)
    .orderBy(desc(jobSearchProfiles.version));

  const versions = [...new Set(profiles.map((p) => p.version))];
  // Also include versions that only appear on jobs
  for (const j of await db.select().from(jobs)) {
    if (j.searchProfileVersion != null) versions.push(j.searchProfileVersion);
  }
  const unique = [...new Set(versions)].sort((a, b) => b - a);
  return Promise.all(
    unique.map(async (v) => {
      const cohort = await computeStrategyCohort(v);
      await persistStrategyCohort(cohort);
      return cohort;
    }),
  );
}

export async function aggregateAllStrategyMetrics() {
  return await listStrategyVersions();
}

/** Deterministic insight bullets grounded only on cohort numbers. */
export function buildGroundedInsights(cohort: StrategyCohort): string[] {
  const insights: string[] = [];
  const minN = cohort.confidence === "low" ? 999 : 2;

  if (cohort.confidence === "low") {
    insights.push(
      `Not enough outcome data yet for Strategy v${cohort.strategyVersion} (${cohort.applicationsN} applications, ${cohort.interviewsN} interviews). Keep logging replies and interviews.`,
    );
    return insights;
  }

  const topTitle = cohort.segments.byTitle.find((s) => s.applications >= minN);
  if (topTitle && topTitle.interviewRate > 0) {
    insights.push(
      `Interviews concentrated on “${topTitle.label}” (${topTitle.interviews}/${topTitle.applications}, ${(topTitle.interviewRate * 100).toFixed(0)}% interview rate · n=${topTitle.applications}).`,
    );
  }

  const topLoc = cohort.segments.byLocation.find((s) => s.applications >= minN);
  if (topLoc && topLoc.responseRate > 0) {
    insights.push(
      `Strongest response geography: ${topLoc.label} (${(topLoc.responseRate * 100).toFixed(0)}% response · n=${topLoc.applications}).`,
    );
  }

  const coldCompanies = cohort.segments.byCompany
    .filter((s) => s.applications >= 2 && s.responses === 0)
    .slice(0, 3);
  if (coldCompanies.length) {
    insights.push(
      `Repeated silence from: ${coldCompanies.map((c) => c.label).join(", ")}. Consider deprioritizing similar companies.`,
    );
  }

  if (cohort.appsPerInterview != null) {
    insights.push(
      `Efficiency: ${cohort.appsPerInterview.toFixed(1)} applications per interview on Strategy v${cohort.strategyVersion}.`,
    );
  }

  if (insights.length === 0) {
    insights.push(
      `Strategy v${cohort.strategyVersion}: ${(cohort.interviewRate * 100).toFixed(0)}% interview rate across ${cohort.applicationsN} applications (${cohort.confidence} confidence).`,
    );
  }

  return insights.slice(0, 5);
}
