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

function contactWasMessaged(contactId: string): boolean {
  const db = getDb();
  const viaDraft = db
    .select()
    .from(drafts)
    .where(eq(drafts.contactId, contactId))
    .all()
    .some((d) => d.state === "sent");
  if (viaDraft) return true;

  const viaThread = db
    .select()
    .from(threads)
    .where(eq(threads.contactId, contactId))
    .all();
  return viaThread.length > 0;
}

/**
 * Delete a contact record. Sent correspondence is retained (drafts/messages
 * keep rows; contact_id nullified). Suppression records are never removed here.
 */
export function deleteContactData(
  contactId: string,
  options?: { force?: boolean },
): { deleted: boolean; reason?: string } {
  const db = getDb();
  const contact = db.select().from(contacts).where(eq(contacts.id, contactId)).get();
  if (!contact) return { deleted: false, reason: "Contact not found" };

  if (!options?.force && contactWasMessaged(contactId)) {
    return {
      deleted: false,
      reason:
        "Contact has sent correspondence — use force to remove PII while keeping messages",
    };
  }

  const now = nowIso();

  // Detach FKs that reference contacts
  for (const draft of db
    .select()
    .from(drafts)
    .where(eq(drafts.contactId, contactId))
    .all()) {
    db.update(drafts)
      .set({ contactId: null, updatedAt: now })
      .where(eq(drafts.id, draft.id))
      .run();
  }

  for (const thread of db
    .select()
    .from(threads)
    .where(eq(threads.contactId, contactId))
    .all()) {
    db.update(threads)
      .set({ contactId: null, updatedAt: now })
      .where(eq(threads.id, thread.id))
      .run();
  }

  db.delete(contacts).where(eq(contacts.id, contactId)).run();

  logger.info({ contactId, companyId: contact.companyId }, "contact_deleted");
  return { deleted: true };
}

/**
 * Remove personal contact rows for a company that were never messaged.
 * Keeps suppressions and any sent message history.
 */
export function deleteCompanyUnsentContacts(companyId: string): {
  deletedIds: string[];
} {
  const rows = getDb()
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, companyId))
    .all();

  const deletedIds: string[] = [];
  for (const row of rows) {
    if (contactWasMessaged(row.id)) continue;
    const result = deleteContactData(row.id);
    if (result.deleted) deletedIds.push(row.id);
  }
  return { deletedIds };
}

/** Soft-scrub: clear email/name on contact but keep id for FK integrity after send. */
export function redactContactPii(contactId: string): void {
  const db = getDb();
  const contact = db.select().from(contacts).where(eq(contacts.id, contactId)).get();
  if (!contact) throw new Error("Contact not found");

  db.update(contacts)
    .set({
      name: "[redacted]",
      email: null,
      role: null,
      sourceUrl: null,
      businessRelevance: null,
      lawfulBasisNote: null,
      countryPolicyApplied: null,
    })
    .where(eq(contacts.id, contactId))
    .run();

  logger.info({ contactId }, "contact_pii_redacted");
}

export function recordPrivacyActivity(
  leadId: string,
  type: string,
  metadata: Record<string, unknown>,
) {
  getDb()
    .insert(activities)
    .values({
      id: newId("act"),
      leadId,
      type,
      metadataJson: JSON.stringify(metadata),
      occurredAt: nowIso(),
    })
    .run();
}

/** Cancel pending follow-ups / invalidate approvals when wiping outreach PII. */
export function cancelPendingOutreachForLead(leadId: string) {
  const db = getDb();
  const now = nowIso();
  const draftIds = db
    .select()
    .from(drafts)
    .where(eq(drafts.leadId, leadId))
    .all()
    .map((d) => d.id);

  if (draftIds.length > 0) {
    for (const approval of db.select().from(approvals).all()) {
      if (draftIds.includes(approval.draftId) && approval.status === "approved") {
        db.update(approvals)
          .set({ status: "invalidated", invalidatedAt: now })
          .where(eq(approvals.id, approval.id))
          .run();
      }
    }
  }

  for (const fu of db
    .select()
    .from(followUps)
    .where(eq(followUps.leadId, leadId))
    .all()) {
    if (fu.state === "pending") {
      db.update(followUps)
        .set({ state: "cancelled", updatedAt: now })
        .where(eq(followUps.id, fu.id))
        .run();
    }
  }
}

export function deleteDraftEditsForLead(leadId: string) {
  const db = getDb();
  const rows = db.select().from(draftEdits).where(eq(draftEdits.leadId, leadId)).all();
  if (rows.length === 0) return;
  db.delete(draftEdits)
    .where(inArray(draftEdits.id, rows.map((r) => r.id)))
    .run();
}
