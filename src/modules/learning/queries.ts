import { desc } from "drizzle-orm";
import { ensureDb } from "@/db/ensure";
import { learningProposals, learningReports } from "@/db/schema";
import { getLearningGates } from "./gates";
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
