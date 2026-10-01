import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { approvals, contacts, drafts } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { getUserSettings, updateUserSettings } from "@/modules/settings/user-settings";

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

export async function invalidateApprovalsForDraft(draftId: string) {
  const db = getDb();
  const now = nowIso();
  const rows = (await db
    .select()
    .from(approvals)
    .where(eq(approvals.draftId, draftId)))
    .filter((a) => a.status === "approved");

  for (const row of rows) {
    await db.update(approvals)
      .set({ status: "invalidated", invalidatedAt: now })
      .where(eq(approvals.id, row.id));
  }
  return rows.length;
}

export async function getActiveApproval(draftId: string) {
  return (await getDb()
    .select()
    .from(approvals)
    .where(eq(approvals.draftId, draftId)))
    .find((a) => a.status === "approved");
}

export async function approveDraft(draftId: string) {
  const db = getDb();
  const draft = (await db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1))[0];
  if (!draft) throw new Error("Draft not found");
  if (draft.state === "sent") throw new Error("Draft already sent");
  if (!draft.contactId) throw new Error("Draft has no contact");

  const contact = (await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, draft.contactId)).limit(1))[0];
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
  await invalidateApprovalsForDraft(draftId);

  const hash = approvalContentHash(
    draft.subject,
    draft.bodyFinal,
    contact.email,
  );
  const now = nowIso();
  const id = newId("appr");

  await db.insert(approvals)
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
    });

  await db.update(drafts)
    .set({ state: "approved", updatedAt: now })
    .where(eq(drafts.id, draftId));

  return id;
}

export async function listApprovedQueue() {
  return (await getDb()
    .select()
    .from(approvals))
    .filter((a) => a.status === "approved")
    .sort((a, b) => a.approvedAt.localeCompare(b.approvedAt));
}

export type MailboxHealth = {
  pausedAt?: string | null;
  pauseReason?: string | null;
};

export async function getMailboxHealth(): Promise<MailboxHealth> {
  const row = (await getUserSettings());
  try {
    return JSON.parse(row?.mailboxHealthJson || "{}") as MailboxHealth;
  } catch {
    return {};
  }
}

export async function setMailboxHealth(health: MailboxHealth) {
  await updateUserSettings({ mailboxHealthJson: JSON.stringify(health) });
}

export async function pauseMailbox(reason: string) {
  await setMailboxHealth({ pausedAt: nowIso(), pauseReason: reason });
}

export async function resumeMailbox() {
  await setMailboxHealth({ pausedAt: null, pauseReason: null });
}
