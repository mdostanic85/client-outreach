import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { contacts, drafts, leads, signals, threads } from "@/db/schema";
import { logger } from "@/lib/logging/logger";
import { deleteContactData } from "./delete";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RetentionResult = {
  dryRun: boolean;
  rejectedLeadContactsDeleted: string[];
  neverContactedDeleted: string[];
  rawSignalsCleared: string[];
};

function olderThan(iso: string, days: number, asOf: Date): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return asOf.getTime() - t >= days * DAY_MS;
}

function wasMessaged(contactId: string): boolean {
  const db = getDb();
  const sent = db
    .select()
    .from(drafts)
    .where(eq(drafts.contactId, contactId))
    .all()
    .some((d) => d.state === "sent");
  if (sent) return true;
  return (
    db.select().from(threads).where(eq(threads.contactId, contactId)).all()
      .length > 0
  );
}

/**
 * Retention (from security/legal ops):
 * - Rejected-lead contact data → delete within 30 days
 * - Never-contacted personal contacts → delete within 30 days
 * - Raw API payloads → clear after 90 days (keep signal metadata)
 * - Suppressions → never pruned here
 * - Sent correspondence → retained
 */
export function runRetentionPrune(options?: {
  dryRun?: boolean;
  rejectedDays?: number;
  neverContactedDays?: number;
  rawSignalDays?: number;
  asOf?: Date;
}): RetentionResult {
  const dryRun = options?.dryRun ?? false;
  const rejectedDays = options?.rejectedDays ?? 30;
  const neverContactedDays = options?.neverContactedDays ?? 30;
  const rawSignalDays = options?.rawSignalDays ?? 90;
  const asOf = options?.asOf ?? new Date();

  const db = getDb();
  const result: RetentionResult = {
    dryRun,
    rejectedLeadContactsDeleted: [],
    neverContactedDeleted: [],
    rawSignalsCleared: [],
  };

  const rejectedLeads = db
    .select()
    .from(leads)
    .all()
    .filter((l) => l.state === "rejected");

  const rejectedCompanyIds = new Set(rejectedLeads.map((l) => l.companyId));

  for (const contact of db.select().from(contacts).all()) {
    if (!olderThan(contact.createdAt, rejectedDays, asOf)) continue;
    if (wasMessaged(contact.id)) continue;

    const onRejectedCompany = rejectedCompanyIds.has(contact.companyId);
    const neverContacted = !wasMessaged(contact.id);

    if (onRejectedCompany && olderThan(contact.createdAt, rejectedDays, asOf)) {
      if (!dryRun) deleteContactData(contact.id, { force: false });
      result.rejectedLeadContactsDeleted.push(contact.id);
      continue;
    }

    if (
      neverContacted &&
      olderThan(contact.createdAt, neverContactedDays, asOf)
    ) {
      // Only prune personal-looking contacts (not generic role inboxes without name)
      const looksPersonal =
        Boolean(contact.name?.trim()) ||
        contact.confidence === "published_personal" ||
        contact.confidence === "manual_confirmed" ||
        contact.confidence === "pattern_unverified" ||
        contact.confidence === "provider_verified";

      if (!looksPersonal) continue;
      if (!dryRun) deleteContactData(contact.id, { force: false });
      result.neverContactedDeleted.push(contact.id);
    }
  }

  for (const signal of db.select().from(signals).all()) {
    if (!signal.rawJson || signal.rawJson === "{}") continue;
    if (!olderThan(signal.createdAt, rawSignalDays, asOf)) continue;
    if (!dryRun) {
      db.update(signals)
        .set({ rawJson: "{}" })
        .where(eq(signals.id, signal.id))
        .run();
    }
    result.rawSignalsCleared.push(signal.id);
  }

  logger.info(result, "retention_prune");
  return result;
}
