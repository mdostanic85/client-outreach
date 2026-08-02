"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureDb } from "@/db/ensure";
import { getSessionUser } from "@/modules/auth/session";
import {
  dismissSetupChecklist,
  getOnboardingStatus,
  markOnboardingComplete,
} from "@/modules/onboarding/state";

export type OnboardingActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function completeOnboardingAction(): Promise<OnboardingActionResult> {
  await ensureDb();
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const status = await getOnboardingStatus(user.id);
  if (!status.hasApprovedProfile) {
    return { ok: false, error: "Approve your profile before finishing setup." };
  }
  if (!status.hasApprovedSearch) {
    return {
      ok: false,
      error: "Approve search criteria before finishing setup.",
    };
  }

  await markOnboardingComplete(user.id);
  revalidatePath("/");
  revalidatePath("/onboarding");
  redirect("/");
}

export async function dismissSetupChecklistAction(): Promise<OnboardingActionResult> {
  await ensureDb();
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };

  await dismissSetupChecklist();
  revalidatePath("/");
  return { ok: true };
}
