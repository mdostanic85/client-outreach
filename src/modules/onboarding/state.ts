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

export function getUserOnboardingCompletedAt(userId: string): string | null {
  const row =
    getDb()
      .select({ onboardingCompletedAt: users.onboardingCompletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .all()[0] ?? null;
  return row?.onboardingCompletedAt ?? null;
}

export function markOnboardingComplete(userId: string) {
  const now = nowIso();
  getDb()
    .update(users)
    .set({ onboardingCompletedAt: now, updatedAt: now })
    .where(eq(users.id, userId))
    .run();
}

/** Legacy users who already finished setup skip the wizard. */
export function maybeBackfillOnboardingComplete(userId: string): boolean {
  const existing = getUserOnboardingCompletedAt(userId);
  if (existing) return true;
  if (getApprovedProfile() && getApprovedSearchProfile()) {
    markOnboardingComplete(userId);
    return true;
  }
  return false;
}

export function getOnboardingStatus(userId: string): OnboardingStatus {
  const completedAt = getUserOnboardingCompletedAt(userId);
  const hasSources = listProfileSources().length > 0;
  const hasApprovedProfile = Boolean(getApprovedProfile());
  const hasApprovedSearch = Boolean(getApprovedSearchProfile());

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

export function isSetupChecklistDismissed(): boolean {
  const row = getDb().select().from(settings).all()[0];
  return Boolean(row?.setupChecklistDismissedAt);
}

export function dismissSetupChecklist() {
  const row = getDb().select().from(settings).all()[0];
  if (!row) return;
  getDb()
    .update(settings)
    .set({ setupChecklistDismissedAt: nowIso(), updatedAt: nowIso() })
    .where(eq(settings.id, row.id))
    .run();
}

export type SetupChecklistItem = {
  id: string;
  label: string;
  href: string;
  done: boolean;
};

export function getSetupChecklistItems(): SetupChecklistItem[] {
  const hasProfile = Boolean(getApprovedProfile());
  const hasSearch = Boolean(getApprovedSearchProfile());
  const hasCollected =
    getDb().select({ id: jobs.id }).from(jobs).limit(1).all().length > 0;
  const styleRaw =
    getDb().select({ style: settings.styleProfileJson }).from(settings).all()[0]
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
