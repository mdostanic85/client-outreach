import { ensureDb } from "@/db/ensure";
import { approvals, drafts, jobs, leads } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export function getNavCounts() {
  const db = ensureDb();
  const leadsCount = db
    .select()
    .from(leads)
    .where(inArray(leads.state, ["suggested", "researched", "saved_for_later"]))
    .all().length;

  const pendingDrafts = db
    .select()
    .from(drafts)
    .where(inArray(drafts.state, ["draft"]))
    .all().length;

  const approvedWaiting = db
    .select()
    .from(approvals)
    .all()
    .filter((a) => a.status === "approved" && !a.consumedAt).length;

  const interestedCount = db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.status, "active"), eq(jobs.triageState, "interested")),
    )
    .all().length;

  return {
    leadsCount,
    queueCount: pendingDrafts + approvedWaiting,
    interestedCount,
  };
}
