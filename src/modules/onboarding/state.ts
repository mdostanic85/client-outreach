import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobs, settings, users } from "@/db/schema";
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
    .set({ onboardingCompletedAt: now, updatedAt: now })
    .where(eq(users.id, userId));
}

/** Legacy users who already finished setup skip the wizard. */
export async function maybeBackfillOnboardingComplete(userId: string): Promise<boolean> {
  const existing = await getUserOnboardingCompletedAt(userId);
  if (existing) return true;
  if ((await getApprovedProfile()) && (await getApprovedSearchProfile())) {
    await markOnboardingComplete(userId);
    return true;
  }
  return false;
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

export async function isSetupChecklistDismissed(): Promise<boolean> {
  const row = (await getDb().select().from(settings).limit(1))[0];
  return Boolean(row?.setupChecklistDismissedAt);
}

export async function dismissSetupChecklist() {
  const row = (await getDb().select().from(settings).limit(1))[0];
  if (!row) return;
  await getDb()
    .update(settings)
    .set({ setupChecklistDismissedAt: nowIso(), updatedAt: nowIso() })
    .where(eq(settings.id, row.id));
}

export type SetupChecklistItem = {
  id: string;
  label: string;
  href: string;
  done: boolean;
};

export async function getSetupChecklistItems(): Promise<SetupChecklistItem[]> {
  const hasProfile = Boolean(await getApprovedProfile());
  const hasSearch = Boolean(await getApprovedSearchProfile());
  const hasCollected =
    (await getDb().select({ id: jobs.id }).from(jobs).limit(1)).length > 0;
  const styleRaw =
    (await getDb().select({ style: settings.styleProfileJson }).from(settings).limit(1))[0]
      ?.style ?? "{}";
  let hasStyle = false;
  try {
    const parsed = JSON.parse(styleRaw) as Record<string, unknown>;
    hasStyle = Object.keys(parsed).length > 0;
  } catch {
    hasStyle = false;
  }

  return [
    {
      id: "profile",
      label: "Approve your work profile",
      href: "/profile",
      done: hasProfile,
    },
    {
      id: "search",
      label: "Approve what jobs to look for",
      href: "/search-criteria",
      done: hasSearch,
    },
    {
      id: "collect",
      label: "Find your first jobs",
      href: "/",
      done: hasCollected,
    },
    {
      id: "style",
      label: "Tune outreach writing style (optional)",
      href: "/settings",
      done: hasStyle,
    },
  ];
}
