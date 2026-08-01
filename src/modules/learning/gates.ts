import { getDb } from "@/db/client";
import {
  deliveryEvents,
  draftEdits,
  leads,
  signals,
} from "@/db/schema";

export type LearningGates = {
  daysOfSignals: number;
  editedDrafts: number;
  deliveredMessages: number;
  ready: boolean;
  missing: string[];
};

const MIN_DAYS = 30;
const MIN_EDITS = 20;
const MIN_DELIVERED = 50;

export function getLearningGates(): LearningGates {
  const db = getDb();

  const signalTimes = db
    .select()
    .from(signals)
    .all()
    .map((s) => s.createdAt)
    .sort();
  let daysOfSignals = 0;
  if (signalTimes.length >= 2) {
    const first = Date.parse(signalTimes[0]!);
    const last = Date.parse(signalTimes[signalTimes.length - 1]!);
    daysOfSignals = Math.max(
      1,
      Math.floor((last - first) / (24 * 60 * 60 * 1000)) + 1,
    );
  } else if (signalTimes.length === 1) {
    daysOfSignals = 1;
  }

  const editedDrafts = db.select().from(draftEdits).all().length;

  const deliveredMessages = db
    .select()
    .from(deliveryEvents)
    .all()
    .filter((e) => e.eventType === "sent").length;

  // Also count manual marked_sent via lead state as soft delivered sample
  const manualSent = db
    .select()
    .from(leads)
    .all()
    .filter((l) =>
      ["sent", "replied", "in_conversation", "closed_won", "closed_lost"].includes(
        l.state,
      ),
    ).length;

  const delivered = Math.max(deliveredMessages, manualSent);

  const missing: string[] = [];
  if (daysOfSignals < MIN_DAYS) {
    missing.push(`signals days ${daysOfSignals}/${MIN_DAYS}`);
  }
  if (editedDrafts < MIN_EDITS) {
    missing.push(`edited drafts ${editedDrafts}/${MIN_EDITS}`);
  }
  if (delivered < MIN_DELIVERED) {
    missing.push(`delivered ${delivered}/${MIN_DELIVERED}`);
  }

  return {
    daysOfSignals,
    editedDrafts,
    deliveredMessages: delivered,
    ready: missing.length === 0,
    missing,
  };
}

/** Allow report generation in dry-run / preview even when gates fail. */
export function assertGatesOrPreview(force = false) {
  const gates = getLearningGates();
  if (!gates.ready && !force) {
    throw new Error(
      `Learning gates not met: ${gates.missing.join("; ")}. Pass force=true for preview.`,
    );
  }
  return gates;
}
