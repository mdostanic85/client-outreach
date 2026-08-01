import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobSearchProfiles } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";

export function approveSearchProfile(id: string): { version: number } {
  const db = getDb();
  const row = db
    .select()
    .from(jobSearchProfiles)
    .where(eq(jobSearchProfiles.id, id))
    .get();
  if (!row) throw new Error("Search profile not found");
  if (row.status === "approved") return { version: row.version };
  if (row.status !== "draft") {
    throw new Error(`Cannot approve search profile in status ${row.status}`);
  }

  const approvedAt = nowIso();
  db.update(jobSearchProfiles)
    .set({ status: "superseded" })
    .where(
      and(
        eq(jobSearchProfiles.status, "approved"),
        ne(jobSearchProfiles.id, id),
      ),
    )
    .run();

  db.update(jobSearchProfiles)
    .set({ status: "approved", approvedAt })
    .where(eq(jobSearchProfiles.id, id))
    .run();

  logger.info({ id, version: row.version }, "job search profile approved");
  return { version: row.version };
}
