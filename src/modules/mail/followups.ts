import { and, eq, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { followUps, leads } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { getSendPolicy } from "./policy";

/** Schedule at most two follow-ups after initial send. Never auto-sends replies. */
export async function scheduleFollowUps(leadId: string, threadId: string) {
  const db = getDb();
  const policy = await getSendPolicy();
  const existing = await db
    .select()
    .from(followUps)
    .where(eq(followUps.leadId, leadId));
  if (existing.length > 0) return;

  const now = Date.now();
  const created = nowIso();

  for (let i = 0; i < Math.min(2, policy.maxFollowUps); i++) {
    const days = policy.followUpOffsetsDays[i] ?? (i === 0 ? 5 : 12);
    const due = new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(followUps)
      .values({
        id: newId("fu"),
        leadId,
        threadId,
        draftId: null,
        sequence: i + 1,
        dueAt: due,
        state: "pending",
        createdAt: created,
        updatedAt: created,
      });
  }

  const firstDue = new Date(
    now + (policy.followUpOffsetsDays[0] ?? 5) * 24 * 60 * 60 * 1000,
  ).toISOString();

  await db.update(leads)
    .set({ followUpAt: firstDue, updatedAt: created })
    .where(eq(leads.id, leadId));
}

export async function cancelFollowUps(leadId: string, reason = "cancelled") {
  const db = getDb();
  const now = nowIso();
  const rows = (await db
    .select()
    .from(followUps)
    .where(eq(followUps.leadId, leadId)))
    .filter((f) => f.state === "pending" || f.state === "queued");

  for (const row of rows) {
    await db.update(followUps)
      .set({ state: reason === "replied" ? "skipped" : "cancelled", updatedAt: now })
      .where(eq(followUps.id, row.id));
  }
}

export async function listDueFollowUps(asOf = nowIso()) {
  return await getDb()
    .select()
    .from(followUps)
    .where(and(eq(followUps.state, "pending"), lte(followUps.dueAt, asOf)));
}

export async function listFollowUpsForLead(leadId: string) {
  return (await getDb()
    .select()
    .from(followUps)
    .where(eq(followUps.leadId, leadId)))
    .sort((a, b) => a.sequence - b.sequence);
}
