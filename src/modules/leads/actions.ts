import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { activities, companies, contacts, leads, suppressions } from "@/db/schema";
import { canGenerateDraft, resolveCountryPolicy } from "@/lib/policy/country";
import { newId, nowIso } from "@/lib/ids";
import type { LeadState } from "./states";
import { assertTransition } from "./transitions";

export const CONTACT_CONFIDENCE = [
  "published_personal",
  "published_generic",
  "manual_confirmed",
  "provider_verified",
  "pattern_unverified",
  "unknown",
] as const;

export type ContactConfidence = (typeof CONTACT_CONFIDENCE)[number];

export function acceptLead(leadId: string) {
  const db = getDb();
  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) throw new Error("Lead not found");
  if (lead.researchStatus !== "complete" && lead.researchStatus !== "incomplete") {
    throw new Error("Lead must be researched before acceptance");
  }

  const now = nowIso();
  db.update(leads)
    .set({ state: "accepted", updatedAt: now })
    .where(eq(leads.id, leadId))
    .run();

  db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "accepted",
      metadataJson: "{}",
      occurredAt: now,
    })
    .run();

  return lead;
}

export function rejectLead(leadId: string, reason: string) {
  if (!reason.trim()) throw new Error("Reject reason is required");
  const db = getDb();
  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) throw new Error("Lead not found");

  const now = nowIso();
  db.update(leads)
    .set({
      state: "rejected",
      rejectReason: reason.trim(),
      updatedAt: now,
    })
    .where(eq(leads.id, leadId))
    .run();

  db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "rejected",
      metadataJson: JSON.stringify({ reason: reason.trim() }),
      occurredAt: now,
    })
    .run();
}

export function saveLeadForLater(leadId: string) {
  const db = getDb();
  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) throw new Error("Lead not found");

  const now = nowIso();
  db.update(leads)
    .set({ state: "saved_for_later", updatedAt: now })
    .where(eq(leads.id, leadId))
    .run();

  db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "saved_for_later",
      metadataJson: "{}",
      occurredAt: now,
    })
    .run();
}

export function setLeadState(leadId: string, state: LeadState, metadata?: Record<string, unknown>) {
  const db = getDb();
  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) throw new Error("Lead not found");
  assertTransition(lead.state as LeadState, state);

  const now = nowIso();
  db.update(leads)
    .set({ state, updatedAt: now })
    .where(eq(leads.id, leadId))
    .run();

  db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: `state:${state}`,
      metadataJson: JSON.stringify(metadata ?? {}),
      occurredAt: now,
    })
    .run();
}

export function markLeadReplied(leadId: string) {
  setLeadState(leadId, "replied");
}

export function setFollowUpDate(leadId: string, followUpAt: string) {
  const db = getDb();
  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) throw new Error("Lead not found");

  const now = nowIso();
  db.update(leads)
    .set({
      followUpAt,
      state: "follow_up_due",
      updatedAt: now,
    })
    .where(eq(leads.id, leadId))
    .run();

  db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "follow_up_set",
      metadataJson: JSON.stringify({ followUpAt }),
      occurredAt: now,
    })
    .run();
}

export function suppressLead(leadId: string, reason: string) {
  const db = getDb();
  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) throw new Error("Lead not found");

  const company = db
    .select()
    .from(companies)
    .where(eq(companies.id, lead.companyId))
    .get();

  const now = nowIso();
  db.insert(suppressions)
    .values({
      id: newId("sup"),
      email: null,
      domain: company?.domain ?? null,
      reason: reason.trim() || "manual_suppression",
      createdAt: now,
    })
    .run();

  db.update(leads)
    .set({ state: "suppressed", updatedAt: now })
    .where(eq(leads.id, leadId))
    .run();

  db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "suppressed",
      metadataJson: JSON.stringify({ reason }),
      occurredAt: now,
    })
    .run();
}

export function addManualContact(input: {
  companyId: string;
  leadId: string;
  name: string;
  email: string;
  role?: string;
  confidence: ContactConfidence;
  businessRelevance?: string;
  lawfulBasisNote?: string;
}) {
  const db = getDb();
  const now = nowIso();
  const id = newId("ct");

  const isPattern = input.confidence === "pattern_unverified";
  const company = db
    .select()
    .from(companies)
    .where(eq(companies.id, input.companyId))
    .get();
  const { policy } = resolveCountryPolicy(company?.country);

  db.insert(contacts)
    .values({
      id,
      companyId: input.companyId,
      name: input.name,
      role: input.role ?? null,
      email: input.email,
      confidence: input.confidence,
      sourceUrl: null,
      businessRelevance:
        input.businessRelevance ??
        (input.role
          ? `Recommended role / decision-maker: ${input.role}`
          : "Manual outreach contact"),
      lawfulBasisNote:
        input.lawfulBasisNote ??
        "Documented business outreach; country policy applied at collection",
      countryPolicyApplied: policy,
      manuallyConfirmed: !isPattern,
      createdAt: now,
    })
    .run();

  db.insert(activities)
    .values({
      id: newId("act"),
      leadId: input.leadId,
      type: "contact_added",
      metadataJson: JSON.stringify({ contactId: id, confidence: input.confidence }),
      occurredAt: now,
    })
    .run();

  return id;
}

/** Promote pattern_unverified → manual_confirmed after human review. */
export function confirmContact(contactId: string, leadId: string) {
  const db = getDb();
  const contact = db.select().from(contacts).where(eq(contacts.id, contactId)).get();
  if (!contact) throw new Error("Contact not found");

  const now = nowIso();
  db.update(contacts)
    .set({
      confidence: "manual_confirmed",
      manuallyConfirmed: true,
    })
    .where(eq(contacts.id, contactId))
    .run();

  db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "contact_confirmed",
      metadataJson: JSON.stringify({
        contactId,
        previousConfidence: contact.confidence,
      }),
      occurredAt: now,
    })
    .run();
}

export function assertDraftJurisdiction(companyId: string) {
  const company = getDb()
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  const check = canGenerateDraft(company?.country);
  if (!check.allowed) {
    throw new Error(check.reason ?? "Jurisdiction policy blocks draft");
  }
  return check;
}
