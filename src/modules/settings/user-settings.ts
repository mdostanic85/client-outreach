import { eq } from "drizzle-orm";
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
  const userId = await currentUserId();
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
}
