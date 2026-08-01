import { desc } from "drizzle-orm";
import { ensureDb } from "@/db/ensure";
import { learningProposals, learningReports } from "@/db/schema";
import { getAdaptiveJobRanking } from "@/modules/jobs/queries";
import { getApprovedSearchProfile } from "@/modules/search-profile/queries";
import { getLearningGates } from "./gates";
import { listStrategyVersions, type StrategyCohort } from "./job-cohorts";
import { getJobLearningGates } from "./job-gates";
import { listAppliedJobs } from "./job-outcomes";
import { buildFunnelAnalytics, buildSourcePerformance } from "./reports";

export function getLearningDashboard() {
  ensureDb();
  const gates = getLearningGates();
  const source = buildSourcePerformance();
  const funnel = buildFunnelAnalytics();
  const proposals = ensureDb()
    .select()
    .from(learningProposals)
    .orderBy(desc(learningProposals.createdAt))
    .all()
    .slice(0, 20);
  const reports = ensureDb()
    .select()
    .from(learningReports)
    .orderBy(desc(learningReports.createdAt))
    .all()
    .slice(0, 20);

  return { gates, source, funnel, proposals, reports };
}

export type JobLearningDashboard = {
  gates: ReturnType<typeof getJobLearningGates>;
  adaptiveRanking: boolean;
  activeStrategyVersion: number | null;
  strategies: StrategyCohort[];
  pendingStrategyProposals: Array<typeof learningProposals.$inferSelect>;
  weeklyReports: Array<typeof learningReports.$inferSelect>;
  appliedJobs: Array<{
    id: string;
    title: string;
    outcome: string;
    appliedAt: string | null;
    searchProfileVersion: number | null;
  }>;
  latestInsights: string[];
  kpis: {
    interviewRate: number;
    responseRate: number;
    offerRate: number;
    applicationsN: number;
    interviewsN: number;
    appsPerInterview: number | null;
    confidence: StrategyCohort["confidence"];
    vsPreviousInterviewDelta: number | null;
  } | null;
};

export function getJobLearningDashboard(): JobLearningDashboard {
  ensureDb();
  const gates = getJobLearningGates();
  const strategies = listStrategyVersions();
  const active = getApprovedSearchProfile();
  const activeVersion = active?.version ?? null;
  const primary =
    strategies.find((s) => s.strategyVersion === activeVersion) ??
    strategies[0] ??
    null;
  const previous =
    primary &&
    strategies.find((s) => s.strategyVersion === primary.strategyVersion - 1);

  const proposals = ensureDb()
    .select()
    .from(learningProposals)
    .orderBy(desc(learningProposals.createdAt))
    .all();

  const reports = ensureDb()
    .select()
    .from(learningReports)
    .orderBy(desc(learningReports.createdAt))
    .all();

  const weeklyReports = reports.filter((r) => r.kind === "job_weekly_insights");
  const pendingStrategyProposals = proposals.filter(
    (p) => p.kind === "search_strategy" && p.status === "pending",
  );

  let latestInsights: string[] = [];
  const latest = weeklyReports[0];
  if (latest) {
    try {
      const data = JSON.parse(latest.dataJson || "{}") as {
        insights?: string[];
      };
      latestInsights = data.insights ?? [];
    } catch {
      latestInsights = [];
    }
  }

  const appliedJobs = listAppliedJobs(30).map((j) => ({
    id: j.id,
    title: j.title,
    outcome: j.outcome,
    appliedAt: j.appliedAt,
    searchProfileVersion: j.searchProfileVersion,
  }));

  return {
    gates,
    adaptiveRanking: getAdaptiveJobRanking(),
    activeStrategyVersion: activeVersion,
    strategies,
    pendingStrategyProposals,
    weeklyReports: weeklyReports.slice(0, 10),
    appliedJobs,
    latestInsights,
    kpis: primary
      ? {
          interviewRate: primary.interviewRate,
          responseRate: primary.responseRate,
          offerRate: primary.offerRate,
          applicationsN: primary.applicationsN,
          interviewsN: primary.interviewsN,
          appsPerInterview: primary.appsPerInterview,
          confidence: primary.confidence,
          vsPreviousInterviewDelta: previous
            ? primary.interviewRate - previous.interviewRate
            : null,
        }
      : null,
  };
}
