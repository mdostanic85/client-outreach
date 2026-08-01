import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { approvals, contacts, drafts, settings } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";

/** sha256(subject + body + recipient) — any edit invalidates approval. */
export function approvalContentHash(
  subject: string,
  body: string,
  recipient: string,
): string {
  return createHash("sha256")
    .update(`${subject}\n${body}\n${recipient.trim().toLowerCase()}`)
    .digest("hex");
}

export function invalidateApprovalsForDraft(draftId: string) {
  const db = getDb();
  const now = nowIso();
  const rows = db
    .select()
    .from(approvals)
    .where(eq(approvals.draftId, draftId))
    .all()
    .filter((a) => a.status === "approved");

  for (const row of rows) {
    db.update(approvals)
      .set({ status: "invalidated", invalidatedAt: now })
      .where(eq(approvals.id, row.id))
      .run();
  }
  return rows.length;
}

export function getActiveApproval(draftId: string) {
  return getDb()
    .select()
    .from(approvals)
    .where(eq(approvals.draftId, draftId))
    .all()
    .find((a) => a.status === "approved");
}

export function approveDraft(draftId: string) {
  const db = getDb();
  const draft = db.select().from(drafts).where(eq(drafts.id, draftId)).get();
  if (!draft) throw new Error("Draft not found");
  if (draft.state === "sent") throw new Error("Draft already sent");
  if (!draft.contactId) throw new Error("Draft has no contact");

  const contact = db
    .select()
    .from(contacts)
    .where(eq(contacts.id, draft.contactId))
    .get();
  if (!contact?.email) throw new Error("Contact email required");

  if (contact.confidence === "pattern_unverified") {
    throw new Error(
      "pattern_unverified contacts are never eligible for automated sending",
    );
  }
  if (contact.confidence === "unknown") {
    throw new Error("Contact confidence must be confirmed before approval");
  }

  // Invalidate any prior approval for this draft
  invalidateApprovalsForDraft(draftId);

  const hash = approvalContentHash(
    draft.subject,
    draft.bodyFinal,
    contact.email,
  );
  const now = nowIso();
  const id = newId("appr");

  db.insert(approvals)
    .values({
      id,
      draftId,
      leadId: draft.leadId,
      recipientEmail: contact.email.trim().toLowerCase(),
      contentHash: hash,
      subjectSnapshot: draft.subject,
      bodySnapshot: draft.bodyFinal,
      status: "approved",
      approvedAt: now,
      invalidatedAt: null,
      consumedAt: null,
    })
    .run();

  db.update(drafts)
    .set({ state: "approved", updatedAt: now })
    .where(eq(drafts.id, draftId))
    .run();

  return id;
}

export function listApprovedQueue() {
  return getDb()
    .select()
    .from(approvals)
    .all()
    .filter((a) => a.status === "approved")
    .sort((a, b) => a.approvedAt.localeCompare(b.approvedAt));
}

export type MailboxHealth = {
  pausedAt?: string | null;
  pauseReason?: string | null;
};

export function getMailboxHealth(): MailboxHealth {
  const row = getDb().select().from(settings).all()[0];
  try {
    return JSON.parse(row?.mailboxHealthJson || "{}") as MailboxHealth;
  } catch {
    return {};
  }
}

export function setMailboxHealth(health: MailboxHealth) {
  const db = getDb();
  const row = db.select().from(settings).all()[0];
  if (!row) throw new Error("Settings not found");
  db.update(settings)
    .set({
      mailboxHealthJson: JSON.stringify(health),
      updatedAt: nowIso(),
    })
    .where(eq(settings.id, row.id))
    .run();
}

export function pauseMailbox(reason: string) {
  setMailboxHealth({ pausedAt: nowIso(), pauseReason: reason });
}

export function resumeMailbox() {
  setMailboxHealth({ pausedAt: null, pauseReason: null });
}
