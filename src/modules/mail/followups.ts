import { and, eq, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { followUps, leads } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { getSendPolicy } from "./policy";

/** Schedule at most two follow-ups after initial send. Never auto-sends replies. */
export function scheduleFollowUps(leadId: string, threadId: string) {
  const db = getDb();
  const policy = getSendPolicy();
  const existing = db
    .select()
    .from(followUps)
    .where(eq(followUps.leadId, leadId))
    .all();
  if (existing.length > 0) return;

  const now = Date.now();
  const created = nowIso();

  for (let i = 0; i < Math.min(2, policy.maxFollowUps); i++) {
    const days = policy.followUpOffsetsDays[i] ?? (i === 0 ? 5 : 12);
    const due = new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
    db.insert(followUps)
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
      })
      .run();
  }

  const firstDue = new Date(
    now + (policy.followUpOffsetsDays[0] ?? 5) * 24 * 60 * 60 * 1000,
  ).toISOString();

  db.update(leads)
    .set({ followUpAt: firstDue, updatedAt: created })
    .where(eq(leads.id, leadId))
    .run();
}

export function cancelFollowUps(leadId: string, reason = "cancelled") {
  const db = getDb();
  const now = nowIso();
  const rows = db
    .select()
    .from(followUps)
    .where(eq(followUps.leadId, leadId))
    .all()
    .filter((f) => f.state === "pending" || f.state === "queued");

  for (const row of rows) {
    db.update(followUps)
      .set({ state: reason === "replied" ? "skipped" : "cancelled", updatedAt: now })
      .where(eq(followUps.id, row.id))
      .run();
  }
}

export function listDueFollowUps(asOf = nowIso()) {
  return getDb()
    .select()
    .from(followUps)
    .where(and(eq(followUps.state, "pending"), lte(followUps.dueAt, asOf)))
    .all();
}

export function listFollowUpsForLead(leadId: string) {
  return getDb()
    .select()
    .from(followUps)
    .where(eq(followUps.leadId, leadId))
    .all()
    .sort((a, b) => a.sequence - b.sequence);
}
