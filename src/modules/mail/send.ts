import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  activities,
  approvals,
  companies,
  contacts,
  deliveryEvents,
  drafts,
  leads,
  messages,
  threads,
} from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { canGenerateDraft } from "@/lib/policy/country";
import {
  approvalContentHash,
  getActiveApproval,
  pauseMailbox,
} from "./approvals";
import { requireGmailCredentials } from "./credentials";
import { scheduleFollowUps } from "./followups";
import {
  checkDailyCap,
  checkMailboxHealth,
  checkSendWindow,
  countNewSendsToday,
  evaluateBounceHealth,
  getSendPolicy,
} from "./policy";
import { assertNotSuppressed } from "./suppression";

function makeRfcMessageId(domain: string): string {
  const local = randomBytes(12).toString("hex");
  return `<${local}@${domain}>`;
}

function createTransport() {
  const creds = requireGmailCredentials();
  return {
    creds,
    transport: nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: creds.user,
        pass: creds.appPassword,
      },
    }),
  };
}

export type SendResult =
  | { ok: true; messageId: string; threadId: string }
  | { ok: false; reason: string };

/**
 * Recheck before every send: hash, recipient, suppression, jurisdiction,
 * daily cap, send window, mailbox health. Never auto-replies.
 */
export async function sendApprovedDraft(approvalId: string): Promise<SendResult> {
  const db = getDb();
  const approval = db
    .select()
    .from(approvals)
    .where(eq(approvals.id, approvalId))
    .get();
  if (!approval) return { ok: false, reason: "Approval not found" };
  if (approval.status !== "approved") {
    return { ok: false, reason: `Approval status is ${approval.status}` };
  }

  const window = checkSendWindow();
  if (!window.ok) return window;

  const health = checkMailboxHealth();
  if (!health.ok) return health;

  const cap = checkDailyCap();
  if (!cap.ok) return cap;

  const draft = db
    .select()
    .from(drafts)
    .where(eq(drafts.id, approval.draftId))
    .get();
  if (!draft) return { ok: false, reason: "Draft not found" };
  if (!draft.contactId) return { ok: false, reason: "Draft has no contact" };

  const contact = db
    .select()
    .from(contacts)
    .where(eq(contacts.id, draft.contactId))
    .get();
  if (!contact?.email) return { ok: false, reason: "Contact email missing" };

  if (contact.confidence === "pattern_unverified") {
    return {
      ok: false,
      reason: "pattern_unverified is never eligible for automatic sending",
    };
  }

  const recipient = contact.email.trim().toLowerCase();
  if (recipient !== approval.recipientEmail.trim().toLowerCase()) {
    return { ok: false, reason: "Recipient changed since approval" };
  }

  const currentHash = approvalContentHash(
    draft.subject,
    draft.bodyFinal,
    recipient,
  );
  if (currentHash !== approval.contentHash) {
    return {
      ok: false,
      reason: "Content changed since approval — re-approve required",
    };
  }

  const lead = db.select().from(leads).where(eq(leads.id, draft.leadId)).get();
  if (!lead) return { ok: false, reason: "Lead not found" };

  const company = db
    .select()
    .from(companies)
    .where(eq(companies.id, lead.companyId))
    .get();

  try {
    assertNotSuppressed(recipient, company?.domain);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  const jurisdiction = canGenerateDraft(company?.country);
  if (!jurisdiction.allowed) {
    return {
      ok: false,
      reason: jurisdiction.reason ?? "Jurisdiction blocks send",
    };
  }
  if (jurisdiction.policy === "blocked") {
    return { ok: false, reason: "Country is blocked" };
  }

  // No tracking pixels / shortened links — plain text only
  const body = draft.bodyFinal;
  if (/https?:\/\/(bit\.ly|t\.co|tinyurl|goo\.gl)\//i.test(body)) {
    return { ok: false, reason: "Shortened links are not allowed" };
  }
  if (/<img[^>]+(1x1|tracking|pixel)/i.test(body)) {
    return { ok: false, reason: "Tracking pixels are not allowed" };
  }

  const { creds, transport } = createTransport();
  const fromDomain = creds.user.includes("@")
    ? creds.user.split("@")[1]
    : "gmail.com";
  const rfcMessageId = makeRfcMessageId(fromDomain);
  const now = nowIso();

  try {
    await transport.sendMail({
      from: creds.user,
      to: recipient,
      subject: draft.subject,
      text: body,
      messageId: rfcMessageId,
      headers: {
        "X-Client-Outreach": "1",
      },
    });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "SMTP send failed");
    return {
      ok: false,
      reason: `SMTP failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const threadId = newId("thr");
  const messageId = newId("msg");

  db.insert(threads)
    .values({
      id: threadId,
      leadId: lead.id,
      contactId: contact.id,
      draftId: draft.id,
      subject: draft.subject,
      rfcMessageId,
      state: "open",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(messages)
    .values({
      id: messageId,
      threadId,
      leadId: lead.id,
      direction: "outbound",
      rfcMessageId,
      inReplyTo: null,
      fromEmail: creds.user,
      toEmail: recipient,
      subject: draft.subject,
      bodyText: body,
      classification: null,
      classificationSource: null,
      imapUid: null,
      createdAt: now,
    })
    .run();

  db.insert(deliveryEvents)
    .values({
      id: newId("dev"),
      messageId,
      leadId: lead.id,
      eventType: "sent",
      detail: null,
      occurredAt: now,
    })
    .run();

  db.update(approvals)
    .set({ status: "consumed", consumedAt: now })
    .where(eq(approvals.id, approval.id))
    .run();

  db.update(drafts)
    .set({ state: "sent", updatedAt: now })
    .where(eq(drafts.id, draft.id))
    .run();

  db.update(leads)
    .set({ state: "sent", updatedAt: now })
    .where(eq(leads.id, lead.id))
    .run();

  db.insert(activities)
    .values({
      id: newId("act"),
      leadId: lead.id,
      type: "sent_automated",
      metadataJson: JSON.stringify({ draftId: draft.id, messageId, threadId }),
      occurredAt: now,
    })
    .run();

  scheduleFollowUps(lead.id, threadId);

  logger.info({ leadId: lead.id, messageId, threadId }, "Outbound email sent");
  return { ok: true, messageId, threadId };
}

/** Process approved queue up to remaining daily cap. */
export async function processSendQueue(limit?: number) {
  const policy = getSendPolicy();
  const remaining = Math.max(0, policy.maxNewPerDay - countNewSendsToday());
  const cap = limit ?? remaining;
  if (cap <= 0) {
    return { processed: 0, sent: 0, skipped: [] as Array<{ id: string; reason: string }> };
  }

  const bounce = evaluateBounceHealth();
  if (bounce.shouldPause) {
    pauseMailbox(bounce.reason ?? "bounce health");
    return {
      processed: 0,
      sent: 0,
      skipped: [{ id: "-", reason: bounce.reason ?? "paused" }],
    };
  }

  const queue = getDb()
    .select()
    .from(approvals)
    .all()
    .filter((a) => a.status === "approved")
    .sort((a, b) => a.approvedAt.localeCompare(b.approvedAt))
    .slice(0, cap);

  let sent = 0;
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const item of queue) {
    const result = await sendApprovedDraft(item.id);
    if (result.ok) sent += 1;
    else skipped.push({ id: item.id, reason: result.reason });
  }

  return { processed: queue.length, sent, skipped };
}

export function verifyApprovalStillValid(draftId: string): boolean {
  const approval = getActiveApproval(draftId);
  if (!approval) return false;
  const draft = getDb().select().from(drafts).where(eq(drafts.id, draftId)).get();
  if (!draft) return false;
  const hash = approvalContentHash(
    draft.subject,
    draft.bodyFinal,
    approval.recipientEmail,
  );
  return hash === approval.contentHash;
}
