import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { listProfileSources, getApprovedProfile } from "@/modules/profile/queries";
import { getApprovedSearchProfile } from "@/modules/search-profile/queries";

export type OnboardingStepId = "welcome" | "profile" | "search" | "done";

export type OnboardingStatus = {
  completed: boolean;
  completedAt: string | null;
  hasSources: boolean;
  hasApprovedProfile: boolean;
  hasApprovedSearch: boolean;
  /** Derived step the wizard should land on. */
  step: OnboardingStepId;
};

export async function getUserOnboardingCompletedAt(userId: string): Promise<string | null> {
  const row =
    (await getDb()
      .select({ onboardingCompletedAt: users.onboardingCompletedAt })
      .from(users)
      .where(eq(users.id, userId)).limit(1))[0] ?? null;
  return row?.onboardingCompletedAt ?? null;
}

export async function markOnboardingComplete(userId: string) {
  const now = nowIso();
  await getDb()
    .update(users)
    .set({ onboardingCompletedAt: now, updatedAt: new Date(now) })
    .where(eq(users.id, userId));
}

export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  const completedAt = await getUserOnboardingCompletedAt(userId);
  const hasSources = (await listProfileSources()).length > 0;
  const hasApprovedProfile = Boolean(await getApprovedProfile());
  const hasApprovedSearch = Boolean(await getApprovedSearchProfile());

  let step: OnboardingStepId = "welcome";
  if (hasApprovedProfile && hasApprovedSearch) {
    step = "done";
  } else if (hasApprovedProfile) {
    step = "search";
  } else if (hasSources) {
    step = "profile";
  }

  return {
    completed: Boolean(completedAt),
    completedAt,
    hasSources,
    hasApprovedProfile,
    hasApprovedSearch,
    step,
  };
}
