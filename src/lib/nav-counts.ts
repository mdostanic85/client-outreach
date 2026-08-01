import { ensureDb } from "@/db/ensure";
import { approvals, drafts, leads } from "@/db/schema";
import { inArray } from "drizzle-orm";

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

  return {
    leadsCount,
    queueCount: pendingDrafts + approvedWaiting,
  };
}
