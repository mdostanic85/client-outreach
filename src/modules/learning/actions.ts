"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server-action";
import { generateWeeklyJobInsights, proposeSearchStrategyUpdate } from "./job-insights";
import { setJobOutcome } from "./job-outcomes";
import type { RecordedJobOutcome } from "./job-outcome-types";
import {
  applyProposal,
  generateMarketReport,
  generatePositioningRecs,
  proposeJobScoringWeights,
  proposeScoringWeights,
  proposeStyleUpdate,
  rejectProposal,
  saveSourcePerformanceReport,
} from "./proposals";

/**
 * Improve page. Client-outreach learning (voice, lead scoring, market,
 * positioning, sources) is owner-only; job-search learning belongs to each
 * account. Proposals never apply themselves: the user approves each one.
 */

export async function saveSourceReportAction() {
  return runAction("learning.saveSourceReport", "owner", async () => {
    const reportId = await saveSourcePerformanceReport();
    revalidatePath("/learning");
    revalidatePath("/analytics");
    return { reportId };
  });
}

export async function proposeStyleAction(force = false) {
  return runAction("learning.proposeStyle", "owner", async () => {
    const proposalId = await proposeStyleUpdate(force);
    revalidatePath("/learning");
    return { proposalId };
  });
}

export async function proposeScoringAction(force = false) {
  return runAction("learning.proposeScoring", "owner", async () => {
    const proposalId = await proposeScoringWeights(force);
    revalidatePath("/learning");
    return { proposalId };
  });
}

export async function generateMarketReportAction(force = false) {
  return runAction("learning.marketReport", "owner", async () => {
    const reportId = await generateMarketReport(force);
    revalidatePath("/learning");
    return { reportId };
  });
}

export async function generatePositioningAction(force = false) {
  return runAction("learning.positioning", "owner", async () => {
    const reportId = await generatePositioningRecs(force);
    revalidatePath("/learning");
    return { reportId };
  });
}

export async function proposeJobScoringAction(force = false) {
  return runAction("learning.proposeJobScoring", "user", async () => {
    const proposalId = await proposeJobScoringWeights(force);
    revalidatePath("/learning");
    return { proposalId };
  });
}

/** Proposals are scoped to their account, so each user can only decide their own. */
export async function applyLearningProposalAction(proposalId: string) {
  return runAction("learning.applyProposal", "user", async () => {
    await applyProposal(proposalId);
    revalidatePath("/learning");
    revalidatePath("/settings/voice");
    revalidatePath("/search-criteria");
    revalidatePath("/");
  });
}

export async function rejectLearningProposalAction(proposalId: string) {
  return runAction("learning.rejectProposal", "user", async () => {
    await rejectProposal(proposalId);
    revalidatePath("/learning");
  });
}

export async function setJobOutcomeAction(
  jobId: string,
  outcome: RecordedJobOutcome,
  note?: string,
) {
  return runAction("learning.setJobOutcome", "user", async () => {
    await setJobOutcome(jobId, outcome, note);
    revalidatePath("/learning");
    revalidatePath("/");
    revalidatePath(`/jobs/${jobId}`);
  });
}

export async function generateWeeklyJobInsightsAction(force = false) {
  return runAction("learning.weeklyJobInsights", "user", async () => {
    const result = await generateWeeklyJobInsights(force);
    revalidatePath("/learning");
    return { reportId: result.reportId };
  });
}

export async function proposeSearchStrategyAction(force = false) {
  return runAction("learning.proposeSearchStrategy", "user", async () => {
    const result = await proposeSearchStrategyUpdate(force);
    revalidatePath("/learning");
    revalidatePath("/search-criteria");
    return { proposalId: result.proposalId, version: result.version };
  });
}
