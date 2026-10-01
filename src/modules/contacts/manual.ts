import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, contacts } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { resolveCountryPolicy } from "@/lib/policy/country";
import { recordLeadActivity } from "@/modules/leads/lifecycle";
import type { ContactConfidence } from "./confidence";

/** Contacts the owner adds or confirms by hand on a lead. */

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
  const company = (
    await db.select().from(companies).where(eq(companies.id, input.companyId)).limit(1)
  )[0];
  const { policy } = await resolveCountryPolicy(company?.country);

  await db.insert(contacts).values({
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

  await recordLeadActivity(
    input.leadId,
    "contact_added",
    { contactId: id, confidence: input.confidence },
    now,
  );
  return id;
}

/** Promote pattern_unverified → manual_confirmed after human review. */
export async function confirmContact(contactId: string, leadId: string) {
  const db = getDb();
  const contact = (
    await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
  )[0];
  if (!contact) throw new Error("Contact not found");

  await db
    .update(contacts)
    .set({ confidence: "manual_confirmed", manuallyConfirmed: true })
    .where(eq(contacts.id, contactId));

  await recordLeadActivity(leadId, "contact_confirmed", {
    contactId,
    previousConfidence: contact.confidence,
  });
}
