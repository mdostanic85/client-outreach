"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server-action";
import { approveSearchProfile, reactivateSearchProfileVersion } from "./approve";
import {
  createDraftFromApprovedSearchProfile,
  generateSearchProfile,
  saveSearchProfileDraft,
} from "./generate";
import type { JobSearchParams } from "./schemas";

/** Search criteria: drafts are edited freely; collectors only read the approved version. */

export async function generateSearchProfileAction() {
  return runAction("searchProfile.generate", "user", async () => {
    const result = await generateSearchProfile({ trigger: "manual" });
    revalidatePath("/search-criteria");
    return result;
  });
}

export async function saveSearchProfileDraftAction(
  id: string,
  params: JobSearchParams,
  rationale?: string[],
) {
  return runAction("searchProfile.saveDraft", "user", async () => {
    await saveSearchProfileDraft(id, params, rationale);
    revalidatePath("/search-criteria");
  });
}

export async function approveSearchProfileAction(id: string) {
  return runAction("searchProfile.approve", "user", async () => {
    const result = await approveSearchProfile(id);
    revalidatePath("/search-criteria");
    revalidatePath("/");
    return result;
  });
}

export async function createSearchDraftFromApprovedAction(params?: JobSearchParams) {
  return runAction("searchProfile.createDraftFromApproved", "user", async () => {
    const result = await createDraftFromApprovedSearchProfile(params ? { params } : undefined);
    revalidatePath("/search-criteria");
    revalidatePath("/onboarding");
    return result;
  });
}

/** Rolls the search strategy back to an earlier version (Improve → history). */
export async function reactivateSearchStrategyAction(version: number) {
  return runAction("searchProfile.reactivateVersion", "user", async () => {
    const result = await reactivateSearchProfileVersion(version);
    revalidatePath("/learning");
    revalidatePath("/search-criteria");
    revalidatePath("/");
    return result;
  });
}
