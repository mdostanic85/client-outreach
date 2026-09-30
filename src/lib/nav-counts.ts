import { cache } from "react";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { ensureDb } from "@/db/ensure";
import { approvals, drafts, jobs, leads } from "@/db/schema";
import { getMarketFitOpenCount } from "@/modules/profile/market-fit";
import { currentUserId, isOwner, owned } from "@/modules/auth/current-user";

async function countRows(
  query: Promise<{ count: number }[]>,
): Promise<number> {
  const row = (await query)[0];
  return Number(row?.count ?? 0);
}

/** Sidebar/topbar badges — SQL counts only; market-fit is cached separately. */
export const getNavCounts = cache(async () => {
  const db = await ensureDb();
  const [owner, leadsCount, pendingDrafts, approvedWaiting, interestedCount, profileFitCount] =
    await Promise.all([
      currentUserId().then(isOwner),
      countRows(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(leads)
          .where(
            inArray(leads.state, ["suggested", "researched", "saved_for_later"]),
          ),
      ),
      countRows(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(drafts)
          .where(inArray(drafts.state, ["draft"])),
      ),
      countRows(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(approvals)
          .where(
            and(eq(approvals.status, "approved"), isNull(approvals.consumedAt)),
          ),
      ),
      countRows(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(jobs)
          .where(
            and(await owned(jobs), eq(jobs.status, "active"), eq(jobs.triageState, "interested")),
          ),
      ),
      getMarketFitOpenCount(),
    ]);

  // Outreach queues belong to the owner's mailbox.
  return {
    isOwner: owner,
    leadsCount: owner ? leadsCount : 0,
    queueCount: owner ? pendingDrafts + approvedWaiting : 0,
    interestedCount,
    profileFitCount,
  };
});
