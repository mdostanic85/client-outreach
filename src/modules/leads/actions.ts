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

export async function acceptLead(leadId: string) {
  const db = getDb();
  const lead = (await db.select().from(leads).where(eq(leads.id, leadId)).limit(1))[0];
  if (!lead) throw new Error("Lead not found");
  if (lead.researchStatus !== "complete" && lead.researchStatus !== "incomplete") {
    throw new Error("Lead must be researched before acceptance");
  }

  const now = nowIso();
  await db.update(leads)
    .set({ state: "accepted", updatedAt: now })
    .where(eq(leads.id, leadId));

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "accepted",
      metadataJson: "{}",
      occurredAt: now,
    });

  return lead;
}

export async function rejectLead(leadId: string, reason: string) {
  if (!reason.trim()) throw new Error("Reject reason is required");
  const db = getDb();
  const lead = (await db.select().from(leads).where(eq(leads.id, leadId)).limit(1))[0];
  if (!lead) throw new Error("Lead not found");

  const now = nowIso();
  await db.update(leads)
    .set({
      state: "rejected",
      rejectReason: reason.trim(),
      updatedAt: now,
    })
    .where(eq(leads.id, leadId));

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "rejected",
      metadataJson: JSON.stringify({ reason: reason.trim() }),
      occurredAt: now,
    });
}

export async function saveLeadForLater(leadId: string) {
  const db = getDb();
  const lead = (await db.select().from(leads).where(eq(leads.id, leadId)).limit(1))[0];
  if (!lead) throw new Error("Lead not found");

  const now = nowIso();
  await db.update(leads)
    .set({ state: "saved_for_later", updatedAt: now })
    .where(eq(leads.id, leadId));

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "saved_for_later",
      metadataJson: "{}",
      occurredAt: now,
    });
}

export async function setLeadState(leadId: string, state: LeadState, metadata?: Record<string, unknown>) {
  const db = getDb();
  const lead = (await db.select().from(leads).where(eq(leads.id, leadId)).limit(1))[0];
  if (!lead) throw new Error("Lead not found");
  assertTransition(lead.state as LeadState, state);

  const now = nowIso();
  await db.update(leads)
    .set({ state, updatedAt: now })
    .where(eq(leads.id, leadId));

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: `state:${state}`,
      metadataJson: JSON.stringify(metadata ?? {}),
      occurredAt: now,
    });
}

export async function markLeadReplied(leadId: string) {
  await setLeadState(leadId, "replied");
}

export async function setFollowUpDate(leadId: string, followUpAt: string) {
  const db = getDb();
  const lead = (await db.select().from(leads).where(eq(leads.id, leadId)).limit(1))[0];
  if (!lead) throw new Error("Lead not found");

  const now = nowIso();
  await db.update(leads)
    .set({
      followUpAt,
      state: "follow_up_due",
      updatedAt: now,
    })
    .where(eq(leads.id, leadId));

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "follow_up_set",
      metadataJson: JSON.stringify({ followUpAt }),
      occurredAt: now,
    });
}

export async function suppressLead(leadId: string, reason: string) {
  const db = getDb();
  const lead = (await db.select().from(leads).where(eq(leads.id, leadId)).limit(1))[0];
  if (!lead) throw new Error("Lead not found");

  const company = (await db
    .select()
    .from(companies)
    .where(eq(companies.id, lead.companyId)).limit(1))[0];

  const now = nowIso();
  await db.insert(suppressions)
    .values({
      id: newId("sup"),
      email: null,
      domain: company?.domain ?? null,
      reason: reason.trim() || "manual_suppression",
      createdAt: now,
    });

  await db.update(leads)
    .set({ state: "suppressed", updatedAt: now })
    .where(eq(leads.id, leadId));

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "suppressed",
      metadataJson: JSON.stringify({ reason }),
      occurredAt: now,
    });
}

export async function addManualContact(input: {
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
  const company = (await db
    .select()
    .from(companies)
    .where(eq(companies.id, input.companyId)).limit(1))[0];
  const { policy } = await resolveCountryPolicy(company?.country);

  await db.insert(contacts)
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
    });

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId: input.leadId,
      type: "contact_added",
      metadataJson: JSON.stringify({ contactId: id, confidence: input.confidence }),
      occurredAt: now,
    });

  return id;
}

/** Promote pattern_unverified → manual_confirmed after human review. */
export async function confirmContact(contactId: string, leadId: string) {
  const db = getDb();
  const contact = (await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1))[0];
  if (!contact) throw new Error("Contact not found");

  const now = nowIso();
  await db.update(contacts)
    .set({
      confidence: "manual_confirmed",
      manuallyConfirmed: true,
    })
    .where(eq(contacts.id, contactId));

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type: "contact_confirmed",
      metadataJson: JSON.stringify({
        contactId,
        previousConfidence: contact.confidence,
      }),
      occurredAt: now,
    });
}

export async function assertDraftJurisdiction(companyId: string) {
  const company = (await getDb()
    .select()
    .from(companies)
    .where(eq(companies.id, companyId)).limit(1))[0];
  const check = await canGenerateDraft(company?.country);
  if (!check.allowed) {
    throw new Error(check.reason ?? "Jurisdiction policy blocks draft");
  }
  return check;
}
