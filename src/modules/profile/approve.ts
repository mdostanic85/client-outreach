import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings, structuredProfiles } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { invalidateMarketFitOpenCount } from "@/modules/profile/market-fit";
import { derivePositioningSummary, parseStructuredProfile } from "./schemas";

/**
 * Approve a draft profile for matching.
 * Supersedes any previously approved profile. Does not overwrite approved silently on re-ingest —
 * re-ingest only creates drafts; this is the explicit gate.
 */
export async function approveStructuredProfile(profileId: string): Promise<{

  version: number;
  syncedPositioning: boolean;
}> {
  const db = getDb();
  const row = (await db
    .select()
    .from(structuredProfiles)
    .where(eq(structuredProfiles.id, profileId)).limit(1))[0];
  if (!row) throw new Error("Profile not found");
  if (row.status === "approved") {
    return { version: row.version, syncedPositioning: false };
  }
  if (row.status !== "draft") {
    throw new Error(`Cannot approve profile in status ${row.status}`);
  }

  const approvedAt = nowIso();

  // Supersede prior approved profiles
  await db.update(structuredProfiles)
    .set({ status: "superseded" })
    .where(
      and(
        eq(structuredProfiles.status, "approved"),
        ne(structuredProfiles.id, profileId),
      ),
    );

  await db.update(structuredProfiles)
    .set({ status: "approved", approvedAt })
    .where(eq(structuredProfiles.id, profileId));

  // Sync freeform positioning blurb only when empty (don't clobber Style edits)
  let syncedPositioning = false;
  const setting = (await db.select().from(settings).limit(1))[0];
  if (setting && !setting.profileMd.trim()) {
    const summary = derivePositioningSummary(
      parseStructuredProfile(row.profileJson),
    );
    if (summary.trim()) {
      await db.update(settings)
        .set({ profileMd: summary, updatedAt: nowIso() })
        .where(eq(settings.id, setting.id));
      syncedPositioning = true;
    }
  }

  logger.info(
    { profileId, version: row.version, syncedPositioning },
    "structured profile approved",
  );

  invalidateMarketFitOpenCount();

  return { version: row.version, syncedPositioning };
}
