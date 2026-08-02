import { ensureDb } from "@/db/ensure";
import { approvals, drafts, jobs, leads } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function getNavCounts() {
  const db = await ensureDb();
  const leadsCount = (await db
    .select()
    .from(leads)
    .where(inArray(leads.state, ["suggested", "researched", "saved_for_later"]))).length;

  const pendingDrafts = (await db
    .select()
    .from(drafts)
    .where(inArray(drafts.state, ["draft"]))).length;

  const approvedWaiting = (await db
    .select()
    .from(approvals))
    .filter((a) => a.status === "approved" && !a.consumedAt).length;

  const interestedCount = (await db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.status, "active"), eq(jobs.triageState, "interested")),
    )).length;

  return {
    leadsCount,
    queueCount: pendingDrafts + approvedWaiting,
    interestedCount,
  };
}
