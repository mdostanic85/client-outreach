import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  activities,
  approvals,
  contacts,
  draftEdits,
  drafts,
  followUps,
  threads,
} from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";

async function contactWasMessaged(contactId: string): Promise<boolean> {
  const db = getDb();
  const viaDraft = (await db
    .select()
    .from(drafts)
    .where(eq(drafts.contactId, contactId)))
    .some((d) => d.state === "sent");
  if (viaDraft) return true;

  const viaThread = await db
    .select()
    .from(threads)
    .where(eq(threads.contactId, contactId));
  return viaThread.length > 0;
}

/**
 * Delete a contact record. Sent correspondence is retained (drafts/messages
 * keep rows; contact_id nullified). Suppression records are never removed here.
 */
export async function deleteContactData(
  contactId: string,
  options?: { force?: boolean },
): Promise<{ deleted: boolean; reason?: string }> {
  const db = getDb();
  const contact = (await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1))[0];
  if (!contact) return { deleted: false, reason: "Contact not found" };

  if (!options?.force && (await contactWasMessaged(contactId))) {
    return {
      deleted: false,
      reason:
        "Contact has sent correspondence — use force to remove PII while keeping messages",
    };
  }

  const now = nowIso();

  // Detach FKs that reference contacts
  for (const draft of await db
    .select()
    .from(drafts)
    .where(eq(drafts.contactId, contactId))) {
    await db.update(drafts)
      .set({ contactId: null, updatedAt: now })
      .where(eq(drafts.id, draft.id));
  }

  for (const thread of await db
    .select()
    .from(threads)
    .where(eq(threads.contactId, contactId))) {
    await db.update(threads)
      .set({ contactId: null, updatedAt: now })
      .where(eq(threads.id, thread.id));
  }

  await db.delete(contacts).where(eq(contacts.id, contactId));

  logger.info({ contactId, companyId: contact.companyId }, "contact_deleted");
  return { deleted: true };
}

/**
 * Remove personal contact rows for a company that were never messaged.
 * Keeps suppressions and any sent message history.
 */
export async function deleteCompanyUnsentContacts(companyId: string): Promise<{
  deletedIds: string[];
}> {
  const rows = await getDb()
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, companyId));

  const deletedIds: string[] = [];
  for (const row of rows) {
    if (await contactWasMessaged(row.id)) continue;
    const result = await deleteContactData(row.id);
    if (result.deleted) deletedIds.push(row.id);
  }
  return { deletedIds };
}

/** Soft-scrub: clear email/name on contact but keep id for FK integrity after send. */
export async function redactContactPii(contactId: string): Promise<void> {
  const db = getDb();
  const contact = (await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1))[0];
  if (!contact) throw new Error("Contact not found");

  await db.update(contacts)
    .set({
      name: "[redacted]",
      email: null,
      role: null,
      sourceUrl: null,
      businessRelevance: null,
      lawfulBasisNote: null,
      countryPolicyApplied: null,
    })
    .where(eq(contacts.id, contactId));

  logger.info({ contactId }, "contact_pii_redacted");
}

export async function recordPrivacyActivity(
  leadId: string,
  type: string,
  metadata: Record<string, unknown>,
) {
  await getDb()
    .insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type,
      metadataJson: JSON.stringify(metadata),
      occurredAt: nowIso(),
    });
}

/** Cancel pending follow-ups / invalidate approvals when wiping outreach PII. */
export async function cancelPendingOutreachForLead(leadId: string) {
  const db = getDb();
  const now = nowIso();
  const draftIds = (await db
    .select()
    .from(drafts)
    .where(eq(drafts.leadId, leadId)))
    .map((d) => d.id);

  if (draftIds.length > 0) {
    for (const approval of await db.select().from(approvals)) {
      if (draftIds.includes(approval.draftId) && approval.status === "approved") {
        await db.update(approvals)
          .set({ status: "invalidated", invalidatedAt: now })
          .where(eq(approvals.id, approval.id));
      }
    }
  }

  for (const fu of await db
    .select()
    .from(followUps)
    .where(eq(followUps.leadId, leadId))) {
    if (fu.state === "pending") {
      await db.update(followUps)
        .set({ state: "cancelled", updatedAt: now })
        .where(eq(followUps.id, fu.id));
    }
  }
}

export async function deleteDraftEditsForLead(leadId: string) {
  const db = getDb();
  const rows = await db.select().from(draftEdits).where(eq(draftEdits.leadId, leadId));
  if (rows.length === 0) return;
  await db.delete(draftEdits)
    .where(inArray(draftEdits.id, rows.map((r) => r.id)));
}
