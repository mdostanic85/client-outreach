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
import { gmailCredentialsConfigured } from "@/modules/mail/credentials";
import {
  countNewSendsToday,
  getSendPolicy,
} from "@/modules/mail/policy";

function enrichDraftRow(draft: typeof drafts.$inferSelect) {
  const db = ensureDb();
  const lead = db.select().from(leads).where(eq(leads.id, draft.leadId)).get();
  const company = lead
    ? db.select().from(companies).where(eq(companies.id, lead.companyId)).get()
    : null;
  const contact = draft.contactId
    ? db.select().from(contacts).where(eq(contacts.id, draft.contactId)).get()
    : null;
  return { draft, lead, company, contact };
}

export function listSendQueue() {
  const db = ensureDb();
  const approved = db
    .select()
    .from(approvals)
    .all()
    .filter((a) => a.status === "approved" && !a.consumedAt)
    .sort((a, b) => a.approvedAt.localeCompare(b.approvedAt));

  return approved.map((approval) => {
    const draft = db
      .select()
      .from(drafts)
      .where(eq(drafts.id, approval.draftId))
      .get();
    const lead = db
      .select()
      .from(leads)
      .where(eq(leads.id, approval.leadId))
      .get();
    const company = lead
      ? db
          .select()
          .from(companies)
          .where(eq(companies.id, lead.companyId))
          .get()
      : null;
    const contact = draft?.contactId
      ? db
          .select()
          .from(contacts)
          .where(eq(contacts.id, draft.contactId))
          .get()
      : null;

    return { approval, draft, lead, company, contact };
  });
}

/** Outbound board: pending drafts, scheduled (approved), sent, failed. */
export function listOutboundBoard() {
  const db = ensureDb();

  const pending = db
    .select()
    .from(drafts)
    .all()
    .filter((d) => d.state === "draft")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((draft) => ({
      ...enrichDraftRow(draft),
      approval: null as typeof approvals.$inferSelect | null,
      tab: "pending" as const,
    }));

  const scheduled = listSendQueue().map((item) => ({
    ...item,
    tab: "scheduled" as const,
  }));

  const sentDrafts = db
    .select()
    .from(drafts)
    .all()
    .filter((d) => d.state === "sent")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 40)
    .map((draft) => ({
      ...enrichDraftRow(draft),
      approval: null as typeof approvals.$inferSelect | null,
      tab: "sent" as const,
    }));

  const failedEvents = db
    .select()
    .from(deliveryEvents)
    .all()
    .filter(
      (e) =>
        e.eventType === "bounce_hard" ||
        e.eventType === "bounce_soft" ||
        e.eventType === "send_failed",
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 40);

  const failed = failedEvents.map((event) => {
    const lead = event.leadId
      ? db.select().from(leads).where(eq(leads.id, event.leadId)).get()
      : null;
    const company = lead
      ? db.select().from(companies).where(eq(companies.id, lead.companyId)).get()
      : null;
    return {
      event,
      lead,
      company,
      tab: "failed" as const,
    };
  });

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

export function getMailboxStatus() {
  ensureDb();
  const policy = getSendPolicy();
  return {
    credentialsConfigured: gmailCredentialsConfigured(),
    health: getMailboxHealth(),
    policy,
    sentToday: countNewSendsToday(),
    remainingToday: Math.max(0, policy.maxNewPerDay - countNewSendsToday()),
  };
}

export function getLeadMailDetail(leadId: string) {
  const db = ensureDb();
  const leadThreads = db
    .select()
    .from(threads)
    .where(eq(threads.leadId, leadId))
    .all();
  const leadMessages = db
    .select()
    .from(messages)
    .where(eq(messages.leadId, leadId))
    .all()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const leadFollowUps = db
    .select()
    .from(followUps)
    .where(eq(followUps.leadId, leadId))
    .all()
    .sort((a, b) => a.sequence - b.sequence);
  const leadApprovals = db
    .select()
    .from(approvals)
    .where(eq(approvals.leadId, leadId))
    .all()
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
  const events = db
    .select()
    .from(deliveryEvents)
    .where(eq(deliveryEvents.leadId, leadId))
    .all()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return {
    threads: leadThreads,
    messages: leadMessages,
    followUps: leadFollowUps,
    approvals: leadApprovals,
    deliveryEvents: events,
  };
}

export function listRecentDeliveryEvents(limit = 30) {
  return ensureDb()
    .select()
    .from(deliveryEvents)
    .orderBy(desc(deliveryEvents.occurredAt))
    .all()
    .slice(0, limit);
}
