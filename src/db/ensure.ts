import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { settings } from "@/db/schema";
import { loadLocalEnv } from "@/lib/env";
import { newId, nowIso } from "@/lib/ids";

let initialized = false;

const DEFAULT_COUNTRY_POLICY = JSON.stringify({
  DE: "prior_interaction_required",
  AT: "prior_interaction_required",
});

export function ensureDb() {
  loadLocalEnv();
  if (initialized) return getDb();
  runMigrations();
  const db = getDb();
  const existing = db.select().from(settings).all()[0];
  if (!existing) {
    const now = nowIso();
    db.insert(settings)
      .values({
        id: newId("set"),
        profileMd:
          "Miloš Dostanić — senior product designer. Fractional design leadership, design systems, and product redesign for product-led companies.",
        targetFiltersJson: JSON.stringify({
          categories: ["design", "product"],
          titleInclude: [
            "design",
            "designer",
            "ux",
            "ui",
            "product design",
            "design system",
            "head of design",
            "design lead",
          ],
          maxAgeDays: 45,
          excludedIndustries: ["adult", "gambling"],
        }),
        dailyLeadCount: 12,
        dailyJobCount: 20,
        todayMode: "jobs",
        aiBudgetUsd: 8,
        styleProfileJson: JSON.stringify({
          voiceNotes: "Direct, senior-to-senior, specific, no fluff.",
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
        createdAt: now,
        updatedAt: now,
      })
      .run();
  } else if (
    !existing.countryPolicyJson ||
    existing.countryPolicyJson === "{}"
  ) {
    db.update(settings)
      .set({
        countryPolicyJson: DEFAULT_COUNTRY_POLICY,
        updatedAt: nowIso(),
      })
      .where(eq(settings.id, existing.id))
      .run();
  }
  initialized = true;
  return db;
}
