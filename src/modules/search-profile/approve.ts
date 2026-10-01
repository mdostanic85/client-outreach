import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobSearchProfiles } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { owned } from "@/modules/auth/current-user";

export async function approveSearchProfile(id: string): Promise<{
 version: number }> {
  const db = getDb();
  const row = (await db
    .select()
    .from(jobSearchProfiles)
    .where(and(await owned(jobSearchProfiles), eq(jobSearchProfiles.id, id))).limit(1))[0];
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
        await owned(jobSearchProfiles),
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
    .where(and(await owned(jobSearchProfiles), eq(jobSearchProfiles.id, id)));

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
    .where(and(await owned(jobSearchProfiles), eq(jobSearchProfiles.id, id))).limit(1))[0];
  if (!row) throw new Error("Search profile not found");
  if (row.status === "approved") return { version: row.version };

  const now = nowIso();
  await db.update(jobSearchProfiles)
    .set({ status: "superseded", supersededAt: now })
    .where(
      and(
        await owned(jobSearchProfiles),
        eq(jobSearchProfiles.status, "approved"),
        ne(jobSearchProfiles.id, id),
      ),
    );

  await db.update(jobSearchProfiles)
    .set({ status: "approved", approvedAt: now, supersededAt: null })
    .where(and(await owned(jobSearchProfiles), eq(jobSearchProfiles.id, id)));

  logger.info({ id, version: row.version }, "job search profile reactivated");
  return { version: row.version };
}

/** Reactivates the newest search profile row stored under `version` (Improve → strategy history). */
export async function reactivateSearchProfileVersion(version: number): Promise<{ version: number }> {
  const row = (
    await getDb()
      .select({ id: jobSearchProfiles.id })
      .from(jobSearchProfiles)
      .where(and(await owned(jobSearchProfiles), eq(jobSearchProfiles.version, version)))
      .orderBy(desc(jobSearchProfiles.createdAt))
      .limit(1)
  )[0];
  if (!row) throw new Error(`No search profile for version ${version}`);
  return reactivateSearchProfile(row.id);
}
