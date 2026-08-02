import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobSearchProfiles } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";

export async function approveSearchProfile(id: string): Promise<{
 version: number }> {
  const db = getDb();
  const row = (await db
    .select()
    .from(jobSearchProfiles)
    .where(eq(jobSearchProfiles.id, id)).limit(1))[0];
  if (!row) throw new Error("Search profile not found");
  if (row.status === "approved") return { version: row.version };
  if (row.status !== "draft" && row.status !== "superseded") {
    throw new Error(`Cannot approve search profile in status ${row.status}`);
  }

  const approvedAt = nowIso();
  await db.update(jobSearchProfiles)
    .set({ status: "superseded", supersededAt: approvedAt })
    .where(
      and(
        eq(jobSearchProfiles.status, "approved"),
        ne(jobSearchProfiles.id, id),
      ),
    );

  await db.update(jobSearchProfiles)
    .set({
      status: "approved",
      approvedAt,
      supersededAt: null,
    })
    .where(eq(jobSearchProfiles.id, id));

  logger.info({ id, version: row.version }, "job search profile approved");
  return { version: row.version };
}

/** Reactivate a superseded strategy version (creates no new version number). */
export async function reactivateSearchProfile(id: string): Promise<{
 version: number }> {
  const db = getDb();
  const row = (await db
    .select()
    .from(jobSearchProfiles)
    .where(eq(jobSearchProfiles.id, id)).limit(1))[0];
  if (!row) throw new Error("Search profile not found");
  if (row.status === "approved") return { version: row.version };

  const now = nowIso();
  await db.update(jobSearchProfiles)
    .set({ status: "superseded", supersededAt: now })
    .where(
      and(
        eq(jobSearchProfiles.status, "approved"),
        ne(jobSearchProfiles.id, id),
      ),
    );

  await db.update(jobSearchProfiles)
    .set({ status: "approved", approvedAt: now, supersededAt: null })
    .where(eq(jobSearchProfiles.id, id));

  logger.info({ id, version: row.version }, "job search profile reactivated");
  return { version: row.version };
}
