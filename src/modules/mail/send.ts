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
import { requireMailCredentials } from "./credentials";
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
  const creds = requireMailCredentials();
  if (creds.authMode === "oauth") {
    return {
      creds,
      transport: nodemailer.createTransport({
        host: creds.smtp.host,
        port: creds.smtp.port,
        secure: creds.smtp.secure,
        auth: {
          type: "OAuth2",
          user: creds.user,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          refreshToken: creds.refreshToken,
        },
      }),
    };
  }
  return {
    creds,
    transport: nodemailer.createTransport({
      host: creds.smtp.host,
      port: creds.smtp.port,
      secure: creds.smtp.secure,
      auth: {
        user: creds.user,
        pass: creds.password,
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
  const approval = (await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, approvalId)).limit(1))[0];
  if (!approval) return { ok: false, reason: "Approval not found" };
  if (approval.status !== "approved") {
    return { ok: false, reason: `Approval status is ${approval.status}` };
  }

  const window = await checkSendWindow();
  if (!window.ok) return window;

  const health = await checkMailboxHealth();
  if (!health.ok) return health;

  const cap = await checkDailyCap();
  if (!cap.ok) return cap;

  const draft = (await db
    .select()
    .from(drafts)
    .where(eq(drafts.id, approval.draftId)).limit(1))[0];
  if (!draft) return { ok: false, reason: "Draft not found" };
  if (!draft.contactId) return { ok: false, reason: "Draft has no contact" };

  const contact = (await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, draft.contactId)).limit(1))[0];
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

  const lead = (await db.select().from(leads).where(eq(leads.id, draft.leadId)).limit(1))[0];
  if (!lead) return { ok: false, reason: "Lead not found" };

  const company = (await db
    .select()
    .from(companies)
    .where(eq(companies.id, lead.companyId)).limit(1))[0];

  try {
    assertNotSuppressed(recipient, company?.domain);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  const jurisdiction = await canGenerateDraft(company?.country);
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
    ? creds.user.split("@")[1]!
    : creds.smtp.host.replace(/^smtp\./i, "") || "localhost";
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

  await db.insert(threads)
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
    });

  await db.insert(messages)
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
    });

  await db.insert(deliveryEvents)
    .values({
      id: newId("dev"),
      messageId,
      leadId: lead.id,
      eventType: "sent",
      detail: null,
      occurredAt: now,
    });

  await db.update(approvals)
    .set({ status: "consumed", consumedAt: now })
    .where(eq(approvals.id, approval.id));

  await db.update(drafts)
    .set({ state: "sent", updatedAt: now })
    .where(eq(drafts.id, draft.id));

  await db.update(leads)
    .set({ state: "sent", updatedAt: now })
    .where(eq(leads.id, lead.id));

  await db.insert(activities)
    .values({
      id: newId("act"),
      leadId: lead.id,
      type: "sent_automated",
      metadataJson: JSON.stringify({ draftId: draft.id, messageId, threadId }),
      occurredAt: now,
    });

  await scheduleFollowUps(lead.id, threadId);

  logger.info({ leadId: lead.id, messageId, threadId }, "Outbound email sent");
  return { ok: true, messageId, threadId };
}

/** Process approved queue up to remaining daily cap. */
export async function processSendQueue(limit?: number) {
  const policy = await getSendPolicy();
  const remaining = Math.max(0, policy.maxNewPerDay - await countNewSendsToday());
  const cap = limit ?? remaining;
  if (cap <= 0) {
    return { processed: 0, sent: 0, skipped: [] as Array<{ id: string; reason: string }> };
  }

  const bounce = await evaluateBounceHealth();
  if (bounce.shouldPause) {
    pauseMailbox(bounce.reason ?? "bounce health");
    return {
      processed: 0,
      sent: 0,
      skipped: [{ id: "-", reason: bounce.reason ?? "paused" }],
    };
  }

  const queue = (await getDb()
    .select()
    .from(approvals))
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

export async function verifyApprovalStillValid(draftId: string): Promise<boolean> {
  const approval = await getActiveApproval(draftId);
  if (!approval) return false;
  const draft = (await getDb().select().from(drafts).where(eq(drafts.id, draftId)).limit(1))[0];
  if (!draft) return false;
  const hash = approvalContentHash(
    draft.subject,
    draft.bodyFinal,
    approval.recipientEmail,
  );
  return hash === approval.contentHash;
}
