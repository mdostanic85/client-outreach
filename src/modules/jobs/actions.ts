"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server-action";
import { setAdaptiveJobRanking } from "@/modules/settings/user-settings";
import { runJobDiscoveryPipeline } from "./pipeline";
import { interestedJob, markJobApplied, rejectJob, saveJobForLater } from "./triage";

/** Job search belongs to each account; every query is scoped to the caller. */

function revalidateJobLists() {
  revalidatePath("/");
  revalidatePath("/interested");
}

/** Synchronous Find jobs (the streaming route is `api/jobs/search`). */
export async function runJobPipelineAction() {
  return runAction("jobs.runPipeline", "user", async () => {
    const stats = await runJobDiscoveryPipeline();
    revalidatePath("/");
    return { stats };
  });
}

export async function interestedJobAction(jobId: string) {
  return runAction("jobs.interested", "user", async () => {
    await interestedJob(jobId);
    revalidateJobLists();
    revalidatePath(`/jobs/${jobId}`);
  });
}

export async function rejectJobAction(jobId: string, reason: string) {
  return runAction("jobs.reject", "user", async () => {
    await rejectJob(jobId, reason);
    revalidateJobLists();
  });
}

export async function saveJobForLaterAction(jobId: string) {
  return runAction("jobs.saveForLater", "user", async () => {
    await saveJobForLater(jobId);
    revalidateJobLists();
  });
}

export async function markJobAppliedAction(jobId: string) {
  return runAction("jobs.markApplied", "user", async () => {
    await markJobApplied(jobId);
    revalidateJobLists();
    revalidatePath(`/jobs/${jobId}`);
  });
}

export async function setAdaptiveJobRankingAction(enabled: boolean) {
  return runAction("jobs.setAdaptiveRanking", "user", async () => {
    await setAdaptiveJobRanking(enabled);
    revalidatePath("/learning");
    revalidatePath("/");
  });
}
