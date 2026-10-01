import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activities, companies, leads, suppressions } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import type { LeadState } from "./states";
import { assertTransition } from "./transitions";

/**
 * Lead state changes made by the owner while reviewing companies. Every change
 * is recorded in `activities` so learning and analytics can replay decisions.
 */

async function loadLead(leadId: string) {
  const lead = (
    await getDb().select().from(leads).where(eq(leads.id, leadId)).limit(1)
  )[0];
  if (!lead) throw new Error("Lead not found");
  return lead;
}

export async function recordLeadActivity(
  leadId: string,
  type: string,
  metadata: Record<string, unknown> = {},
  occurredAt = nowIso(),
) {
  await getDb()
    .insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type,
      metadataJson: JSON.stringify(metadata),
      occurredAt,
    });
}

export async function acceptLead(leadId: string) {
  const lead = await loadLead(leadId);
  if (lead.researchStatus !== "complete" && lead.researchStatus !== "incomplete") {
    throw new Error("Lead must be researched before acceptance");
  }

  const now = nowIso();
  await getDb()
    .update(leads)
    .set({ state: "accepted", updatedAt: now })
    .where(eq(leads.id, leadId));
  await recordLeadActivity(leadId, "accepted", {}, now);
  return lead;
}

export async function rejectLead(leadId: string, reason: string) {
  if (!reason.trim()) throw new Error("Reject reason is required");
  await loadLead(leadId);

  const now = nowIso();
  await getDb()
    .update(leads)
    .set({ state: "rejected", rejectReason: reason.trim(), updatedAt: now })
    .where(eq(leads.id, leadId));
  await recordLeadActivity(leadId, "rejected", { reason: reason.trim() }, now);
}

export async function saveLeadForLater(leadId: string) {
  await loadLead(leadId);

  const now = nowIso();
  await getDb()
    .update(leads)
    .set({ state: "saved_for_later", updatedAt: now })
    .where(eq(leads.id, leadId));
  await recordLeadActivity(leadId, "saved_for_later", {}, now);
}

/** Moves a lead along the allowed transitions (see `transitions.ts`). */
export async function setLeadState(
  leadId: string,
  state: LeadState,
  metadata?: Record<string, unknown>,
) {
  const lead = await loadLead(leadId);
  assertTransition(lead.state as LeadState, state);

  const now = nowIso();
  await getDb()
    .update(leads)
    .set({ state, updatedAt: now })
    .where(eq(leads.id, leadId));
  await recordLeadActivity(leadId, `state:${state}`, metadata ?? {}, now);
}

export async function markLeadReplied(leadId: string) {
  await setLeadState(leadId, "replied");
}

export async function setFollowUpDate(leadId: string, followUpAt: string) {
  await loadLead(leadId);

  const now = nowIso();
  await getDb()
    .update(leads)
    .set({ followUpAt, state: "follow_up_due", updatedAt: now })
    .where(eq(leads.id, leadId));
  await recordLeadActivity(leadId, "follow_up_set", { followUpAt }, now);
}

/** Stops all outreach to the lead's company domain, now and in future discovery. */
export async function suppressLead(leadId: string, reason: string) {
  const lead = await loadLead(leadId);
  const db = getDb();
  const company = (
    await db.select().from(companies).where(eq(companies.id, lead.companyId)).limit(1)
  )[0];

  const now = nowIso();
  await db.insert(suppressions).values({
    id: newId("sup"),
    email: null,
    domain: company?.domain ?? null,
    reason: reason.trim() || "manual_suppression",
    createdAt: now,
  });
  await db
    .update(leads)
    .set({ state: "suppressed", updatedAt: now })
    .where(eq(leads.id, leadId));
  await recordLeadActivity(leadId, "suppressed", { reason }, now);
}

/** Owner's recommended contact role for a lead, used to steer people extraction. */
export async function getLeadRecommendedRole(leadId: string): Promise<string | null> {
  const row = (
    await getDb()
      .select({ role: leads.recommendedContactRole })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1)
  )[0];
  return row?.role ?? null;
}
