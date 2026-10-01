import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { currentUserId } from "@/modules/auth/current-user";

export type UserSettings = typeof settings.$inferSelect;

const DEFAULT_COUNTRY_POLICY = JSON.stringify({
  DE: "prior_interaction_required",
  AT: "prior_interaction_required",
});

function defaultSettings(userId: string): typeof settings.$inferInsert {
  const now = nowIso();
  return {
    id: newId("set"),
    userId,
    profileMd: "",
    targetFiltersJson: JSON.stringify({ maxAgeDays: 45 }),
    dailyLeadCount: 12,
    dailyJobCount: 20,
    todayMode: "jobs",
    aiBudgetUsd: 8,
    styleProfileJson: JSON.stringify({
      voiceNotes: "Direct, specific, no fluff.",
      doList: ["One concrete company fact", "Clear low-friction ask"],
      dontList: ["Generic praise", "Long intros"],
      preferredLength: "70-120 words",
      ctaPatterns: ["short call or async note"],
      proofPoints: [],
      languageNotes: {},
      examples: [],
    }),
    countryPolicyJson: DEFAULT_COUNTRY_POLICY,
    sendPolicyJson: JSON.stringify({
      maxNewPerDay: 5,
      weekdaysOnly: true,
      maxFollowUps: 2,
      followUpOffsetsDays: [5, 12],
    }),
    mailboxHealthJson: "{}",
    opsChecklistJson: "{}",
    adaptiveJobRanking: 1,
    usePortfolioInMatching: 1,
    matchingSourcesJson: JSON.stringify({
      portfolioProjects: true,
      linkedin: true,
      cv: true,
      manual: true,
      github: true,
      jobPreferences: true,
      activitySignals: true,
    }),
    createdAt: now,
    updatedAt: now,
  };
}

/** The signed-in (or scoped) account's settings row, created with defaults on first use. */
export async function getUserSettings(): Promise<UserSettings> {
  return getSettingsFor(await currentUserId());
}

/** Per-request memo: layout and page both read settings on every render. */
const getSettingsFor = cache(async (userId: string): Promise<UserSettings> => {
  const db = getDb();
  const existing = (
    await db.select().from(settings).where(eq(settings.userId, userId)).limit(1)
  )[0];
  if (existing) return existing;

  await db
    .insert(settings)
    .values(defaultSettings(userId))
    .onConflictDoNothing({ target: settings.userId });
  return (
    await db.select().from(settings).where(eq(settings.userId, userId)).limit(1)
  )[0]!;
});

/** Settings columns an account may change (identity and timestamps are managed here). */
export type UserSettingsPatch = Partial<
  Omit<typeof settings.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">
>;

/**
 * Writes the given columns on the current account's settings row.
 * Keys left `undefined` keep their stored value.
 */
export async function updateUserSettings(patch: UserSettingsPatch): Promise<void> {
  const row = await getUserSettings();
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as UserSettingsPatch;
  await getDb()
    .update(settings)
    .set({ ...defined, updatedAt: nowIso() })
    .where(and(eq(settings.userId, row.userId), eq(settings.id, row.id)));
}

export type TodayMode = "jobs" | "clients";

/** Which list Today opens on. Companies is owner-only; callers gate it. */
export async function getTodayMode(): Promise<TodayMode> {
  return (await getUserSettings()).todayMode === "clients" ? "clients" : "jobs";
}

export async function setTodayMode(mode: TodayMode): Promise<void> {
  await updateUserSettings({ todayMode: mode });
}

/** Learned ranking boosts on Today; on unless the account turned it off. */
export async function getAdaptiveJobRanking(): Promise<boolean> {
  return (await getUserSettings()).adaptiveJobRanking !== 0;
}

export async function setAdaptiveJobRanking(enabled: boolean): Promise<void> {
  await updateUserSettings({ adaptiveJobRanking: enabled ? 1 : 0 });
}

/** Fields edited on Settings → Outreach voice (owner only). */
export type OutreachSettingsInput = Pick<
  UserSettingsPatch,
  | "profileMd"
  | "styleProfileJson"
  | "targetFiltersJson"
  | "countryPolicyJson"
  | "sendPolicyJson"
  | "dailyLeadCount"
  | "aiBudgetUsd"
>;

export async function updateOutreachSettings(input: OutreachSettingsInput): Promise<void> {
  await updateUserSettings({
    profileMd: input.profileMd,
    styleProfileJson: input.styleProfileJson,
    targetFiltersJson: input.targetFiltersJson,
    countryPolicyJson: input.countryPolicyJson,
    sendPolicyJson: input.sendPolicyJson,
    dailyLeadCount: input.dailyLeadCount,
    aiBudgetUsd: input.aiBudgetUsd,
  });
}
