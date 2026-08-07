import { desc, eq } from "drizzle-orm";
import { ensureDb } from "@/db/ensure";
import {
  approvals,
  companies,
  contacts,
  deliveryEvents,
  drafts,
  followUps,
  leads,
  messages,
  threads,
} from "@/db/schema";
import { getMailboxHealth } from "@/modules/mail/approvals";
import { mailCredentialsConfigured } from "@/modules/mail/credentials";
import {
  countNewSendsToday,
  getSendPolicy,
} from "@/modules/mail/policy";

async function enrichDraftRow(draft: typeof drafts.$inferSelect) {
  const db = await ensureDb();
  const lead = (await db.select().from(leads).where(eq(leads.id, draft.leadId)).limit(1))[0];
  const company = lead
    ? (await db.select().from(companies).where(eq(companies.id, lead.companyId)).limit(1))[0]
    : null;
  const contact = draft.contactId
    ? (await db.select().from(contacts).where(eq(contacts.id, draft.contactId)).limit(1))[0]
    : null;
  return { draft, lead, company, contact };
}

export async function listSendQueue() {
  const db = await ensureDb();
  const approved = (await db
    .select()
    .from(approvals))
    .filter((a) => a.status === "approved" && !a.consumedAt)
    .sort((a, b) => a.approvedAt.localeCompare(b.approvedAt));

  return Promise.all(
    approved.map(async (approval) => {
    const draft = (await db
      .select()
      .from(drafts)
      .where(eq(drafts.id, approval.draftId)).limit(1))[0];
    const lead = (await db
      .select()
      .from(leads)
      .where(eq(leads.id, approval.leadId)).limit(1))[0];
    const company = lead
      ? (await db
          .select()
          .from(companies)
          .where(eq(companies.id, lead.companyId)).limit(1))[0]
      : null;
    const contact = draft?.contactId
      ? (await db
          .select()
          .from(contacts)
          .where(eq(contacts.id, draft.contactId)).limit(1))[0]
      : null;

    return { approval, draft, lead, company, contact };
  }),
  );
}

/** Outbound board: pending drafts, scheduled (approved), sent, failed. */
export async function listOutboundBoard() {
  const db = await ensureDb();

  const pending = await Promise.all(
    (await db
      .select()
      .from(drafts))
      .filter((d) => d.state === "draft")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(async (draft) => ({
        ...(await enrichDraftRow(draft)),
        approval: null as typeof approvals.$inferSelect | null,
        tab: "pending" as const,
      })),
  );

  const scheduled = (await listSendQueue()).map((item) => ({
    ...item,
    tab: "scheduled" as const,
  }));

  const sentDrafts = await Promise.all(
    (await db
      .select()
      .from(drafts))
      .filter((d) => d.state === "sent")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 40)
      .map(async (draft) => ({
        ...(await enrichDraftRow(draft)),
        approval: null as typeof approvals.$inferSelect | null,
        tab: "sent" as const,
      })),
  );

  const failedEvents = (await db
    .select()
    .from(deliveryEvents))
    .filter(
      (e) =>
        e.eventType === "bounce_hard" ||
        e.eventType === "bounce_soft" ||
        e.eventType === "send_failed",
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 40);

  const failed = await Promise.all(
    failedEvents.map(async (event) => {
    const lead = event.leadId
      ? (await db.select().from(leads).where(eq(leads.id, event.leadId)).limit(1))[0]
      : null;
    const company = lead
      ? (await db.select().from(companies).where(eq(companies.id, lead.companyId)).limit(1))[0]
      : null;
    return {
      event,
      lead,
      company,
      tab: "failed" as const,
    };
  }),
  );

  return {
    pending,
    scheduled,
    sent: sentDrafts,
    failed,
    counts: {
      pending: pending.length,
      scheduled: scheduled.length,
      sent: sentDrafts.length,
      failed: failed.length,
    },
  };
}

export async function getMailboxStatus() {
  await ensureDb();
  const policy = await getSendPolicy();
  return {
    credentialsConfigured: mailCredentialsConfigured(),
    health: await getMailboxHealth(),
    policy,
    sentToday: await countNewSendsToday(),
    remainingToday: Math.max(0, policy.maxNewPerDay - await countNewSendsToday()),
  };
}

export async function getLeadMailDetail(leadId: string) {
  const db = await ensureDb();
  const leadThreads = await db
    .select()
    .from(threads)
    .where(eq(threads.leadId, leadId));
  const leadMessages = (await db
    .select()
    .from(messages)
    .where(eq(messages.leadId, leadId)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const leadFollowUps = (await db
    .select()
    .from(followUps)
    .where(eq(followUps.leadId, leadId)))
    .sort((a, b) => a.sequence - b.sequence);
  const leadApprovals = (await db
    .select()
    .from(approvals)
    .where(eq(approvals.leadId, leadId)))
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
  const events = (await db
    .select()
    .from(deliveryEvents)
    .where(eq(deliveryEvents.leadId, leadId)))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return {
    threads: leadThreads,
    messages: leadMessages,
    followUps: leadFollowUps,
    approvals: leadApprovals,
    deliveryEvents: events,
  };
}

export async function listRecentDeliveryEvents(limit = 30) {
  const db = await ensureDb();
  return (
    await db
      .select()
      .from(deliveryEvents)
      .orderBy(desc(deliveryEvents.occurredAt))
  ).slice(0, limit);
}
