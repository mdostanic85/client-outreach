import { ImapFlow } from "imapflow";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  activities,
  deliveryEvents,
  leads,
  mailSyncCursors,
  messages,
  threads,
} from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { pauseMailbox } from "./approvals";
import { classifyReply } from "./classify";
import { getMailAccessToken, requireMailCredentials } from "./credentials";
import { cancelFollowUps } from "./followups";
import { evaluateBounceHealth } from "./policy";
import { suppressEmail } from "./suppression";

function normalizeMessageId(id?: string | null): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("<") ? trimmed : `<${trimmed}>`;
}

async function getOrCreateCursor(mailbox: string, folder: string) {
  const db = getDb();
  const existing = (await db
    .select()
    .from(mailSyncCursors))
    .find((c) => c.mailbox === mailbox && c.folder === folder);
  if (existing) return existing;

  const id = newId("cur");
  const now = nowIso();
  await db.insert(mailSyncCursors)
    .values({
      id,
      mailbox,
      folder,
      uidValidity: null,
      lastUid: 0,
      updatedAt: now,
    });
  return (await db.select().from(mailSyncCursors).where(eq(mailSyncCursors.id, id)).limit(1))[0]!;
}

async function findThreadByHeaders(inReplyTo?: string | null, references?: string) {
  const db = getDb();
  const candidates = [
    normalizeMessageId(inReplyTo),
    ...(references
      ? references.split(/\s+/).map((r) => normalizeMessageId(r))
      : []),
  ].filter(Boolean) as string[];

  for (const mid of candidates) {
    const byThread = (await db
      .select()
      .from(threads))
      .find((t) => t.rfcMessageId === mid);
    if (byThread) return byThread;

    const byMsg = (await db
      .select()
      .from(messages))
      .find((m) => m.rfcMessageId === mid);
    if (byMsg) {
      return (await db
        .select()
        .from(threads)
        .where(eq(threads.id, byMsg.threadId)).limit(1))[0];
    }
  }
  return null;
}

async function findThreadBySender(fromEmail: string) {
  const db = getDb();
  const outbound = (await db
    .select()
    .from(messages))
    .filter(
      (m) =>
        m.direction === "outbound" &&
        m.toEmail.toLowerCase() === fromEmail.toLowerCase(),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!outbound) return null;
  return (await db
    .select()
    .from(threads)
    .where(eq(threads.id, outbound.threadId)).limit(1))[0];
}

async function handleInbound(input: {
  uid: number;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  rfcMessageId: string | null;
  inReplyTo: string | null;
  references?: string;
}) {
  const db = getDb();
  const existing = input.rfcMessageId
    ? (await db
        .select()
        .from(messages))
        .find((m) => m.rfcMessageId === input.rfcMessageId)
    : null;
  if (existing) return { skipped: true as const };

  const thread =
    (await findThreadByHeaders(input.inReplyTo, input.references)) ??
    (await findThreadBySender(input.fromEmail));

  if (!thread) {
    logger.info(
      { from: input.fromEmail, subject: input.subject },
      "Inbound mail unmatched to outreach thread",
    );
    return { skipped: true as const, unmatched: true };
  }

  const { classification, source } = await classifyReply(
    input.subject,
    input.bodyText,
  );

  const now = nowIso();
  const messageId = newId("msg");

  await db.insert(messages)
    .values({
      id: messageId,
      threadId: thread.id,
      leadId: thread.leadId,
      direction: "inbound",
      rfcMessageId: input.rfcMessageId,
      inReplyTo: input.inReplyTo,
      fromEmail: input.fromEmail,
      toEmail: input.toEmail,
      subject: input.subject,
      bodyText: input.bodyText,
      classification,
      classificationSource: source,
      imapUid: input.uid,
      createdAt: now,
    });

  await db.update(threads)
    .set({ updatedAt: now })
    .where(eq(threads.id, thread.id));

  if (classification === "bounce_hard" || classification === "bounce_soft") {
    await db.insert(deliveryEvents)
      .values({
        id: newId("dev"),
        messageId,
        leadId: thread.leadId,
        eventType: classification,
        detail: input.subject.slice(0, 200),
        occurredAt: now,
      });

    if (classification === "bounce_hard") {
      const outbound = (await db
        .select()
        .from(messages))
        .find(
          (m) => m.threadId === thread!.id && m.direction === "outbound",
        );
      if (outbound) await suppressEmail(outbound.toEmail, "hard_bounce");

      const bounce = await evaluateBounceHealth();
      if (bounce.shouldPause) {
        await pauseMailbox(bounce.reason ?? "hard bounce threshold");
      }
    }
  }

  if (classification === "unsubscribe") {
    const outbound = (await db
      .select()
      .from(messages))
      .find((m) => m.threadId === thread!.id && m.direction === "outbound");
    if (outbound) await suppressEmail(outbound.toEmail, "opt_out");
    await cancelFollowUps(thread.leadId, "cancelled");
    await db.update(leads)
      .set({ state: "suppressed", updatedAt: now })
      .where(eq(leads.id, thread.leadId));
  }

  if (classification === "reply") {
    await db.update(leads)
      .set({ state: "replied", updatedAt: now })
      .where(eq(leads.id, thread.leadId));
    await cancelFollowUps(thread.leadId, "replied");
    await db.insert(activities)
      .values({
        id: newId("act"),
        leadId: thread.leadId,
        type: "replied_synced",
        metadataJson: JSON.stringify({ messageId, classification }),
        occurredAt: now,
      });
  }

  // Never send automatic replies
  return { skipped: false as const, classification, messageId };
}

/** Sync INBOX via IMAP. Cursor-based UID fetch. */
export async function syncInbox(folder = "INBOX") {
  const creds = requireMailCredentials();
  const auth =
    creds.authMode === "oauth"
      ? {
          user: creds.user,
          accessToken: await getMailAccessToken(creds),
        }
      : {
          user: creds.user,
          pass: creds.password!,
        };
  const client = new ImapFlow({
    host: creds.imap.host,
    port: creds.imap.port,
    secure: creds.imap.secure,
    auth,
    logger: false,
  });

  const stats = {
    fetched: 0,
    stored: 0,
    unmatched: 0,
    classifications: {} as Record<string, number>,
  };

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const mailbox = client.mailbox;
      if (!mailbox) {
        throw new Error("Failed to open mailbox");
      }

      const cursor = await getOrCreateCursor(creds.user, folder);
      const uidValidity = String(mailbox.uidValidity);
      let lastUid = cursor.lastUid;

      if (cursor.uidValidity && cursor.uidValidity !== uidValidity) {
        logger.warn(
          { folder, old: cursor.uidValidity, next: uidValidity },
          "UIDVALIDITY changed — resetting cursor",
        );
        lastUid = 0;
      }

      const range = lastUid > 0 ? `${lastUid + 1}:*` : "1:*";
      let maxUid = lastUid;

      try {
        for await (const msg of client.fetch(
          range,
          {
            uid: true,
            envelope: true,
            source: true,
          },
          { uid: true },
        )) {
          stats.fetched += 1;
          maxUid = Math.max(maxUid, msg.uid);

          const envelope = msg.envelope;
          const fromEmail =
            envelope?.from?.[0]?.address?.toLowerCase() ?? "";
          const toEmail =
            envelope?.to?.[0]?.address ?? creds.user;

          const subject = envelope?.subject ?? "(no subject)";
          const rfcMessageId = normalizeMessageId(envelope?.messageId);
          const inReplyToRaw = envelope?.inReplyTo;
          const inReplyTo = normalizeMessageId(
            Array.isArray(inReplyToRaw) ? inReplyToRaw[0] : inReplyToRaw,
          );

          let bodyText = "";
          if (msg.source) {
            const raw = msg.source.toString("utf8");
            const textPart = raw.split(/\r?\n\r?\n/).slice(1).join("\n\n");
            bodyText = textPart
              .replace(/--[^\n]+[\s\S]*$/m, "")
              .replace(/<[^>]+>/g, " ")
              .slice(0, 20000);
          }

          if (fromEmail.toLowerCase() === creds.user.toLowerCase()) {
            continue;
          }

          const result = await handleInbound({
            uid: msg.uid,
            fromEmail,
            toEmail,
            subject,
            bodyText,
            rfcMessageId,
            inReplyTo,
          });

          if (result.skipped && "unmatched" in result && result.unmatched) {
            stats.unmatched += 1;
          } else if (!result.skipped && "classification" in result) {
            stats.stored += 1;
            const c = result.classification ?? "other";
            stats.classifications[c] = (stats.classifications[c] ?? 0) + 1;
          }
        }
      } catch (err) {
        // Empty range after lastUid can throw on some servers
        const message = err instanceof Error ? err.message : String(err);
        if (!/nothing to fetch|no messages/i.test(message)) {
          throw err;
        }
      }

      await getDb()
        .update(mailSyncCursors)
        .set({
          uidValidity,
          lastUid: maxUid,
          updatedAt: nowIso(),
        })
        .where(eq(mailSyncCursors.id, cursor.id));
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
  }

  logger.info(stats, "Mail sync complete");
  return stats;
}
