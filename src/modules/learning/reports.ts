import { getDb } from "@/db/client";
import {
  deliveryEvents,
  draftEdits,
  leads,
  messages,
  signals,
} from "@/db/schema";

export type SourcePerfRow = {
  source: string;
  signals: number;
  leads: number;
  accepted: number;
  rejected: number;
  sent: number;
  replied: number;
  acceptRate: number;
  replyRate: number;
};

export async function buildSourcePerformance(): Promise<{
  rows: SourcePerfRow[];
  generatedAt: string;
}> {
  const db = getDb();
  const allSignals = await db.select().from(signals);
  const allLeads = await db.select().from(leads);

  const companySource = new Map<string, string>();
  for (const s of allSignals) {
    if (!companySource.has(s.companyId)) {
      companySource.set(s.companyId, s.source);
    }
  }

  const bySource = new Map<
    string,
    {
      signals: number;
      leadIds: Set<string>;
      accepted: number;
      rejected: number;
      sent: number;
      replied: number;
    }
  >();

  for (const s of allSignals) {
    const bucket = bySource.get(s.source) ?? {
      signals: 0,
      leadIds: new Set<string>(),
      accepted: 0,
      rejected: 0,
      sent: 0,
      replied: 0,
    };
    bucket.signals += 1;
    bySource.set(s.source, bucket);
  }

  for (const lead of allLeads) {
    const source = companySource.get(lead.companyId) ?? "unknown";
    const bucket = bySource.get(source) ?? {
      signals: 0,
      leadIds: new Set<string>(),
      accepted: 0,
      rejected: 0,
      sent: 0,
      replied: 0,
    };
    bucket.leadIds.add(lead.id);
    if (["accepted", "draft_ready", "sent", "replied", "in_conversation", "closed_won", "closed_lost", "follow_up_due"].includes(lead.state)) {
      bucket.accepted += 1;
    }
    if (lead.state === "rejected") bucket.rejected += 1;
    if (["sent", "replied", "in_conversation", "closed_won", "closed_lost"].includes(lead.state)) {
      bucket.sent += 1;
    }
    if (["replied", "in_conversation", "closed_won"].includes(lead.state)) {
      bucket.replied += 1;
    }
    bySource.set(source, bucket);
  }

  const rows: SourcePerfRow[] = [...bySource.entries()]
    .map(([source, b]) => {
      const leadsCount = b.leadIds.size;
      return {
        source,
        signals: b.signals,
        leads: leadsCount,
        accepted: b.accepted,
        rejected: b.rejected,
        sent: b.sent,
        replied: b.replied,
        acceptRate: leadsCount ? b.accepted / leadsCount : 0,
        replyRate: b.sent ? b.replied / b.sent : 0,
      };
    })
    .sort((a, b) => b.accepted - a.accepted || b.signals - a.signals);

  return { rows, generatedAt: new Date().toISOString() };
}

export async function buildFunnelAnalytics() {
  const db = getDb();
  const allLeads = await db.select().from(leads);
  const counts: Record<string, number> = {};
  for (const l of allLeads) {
    counts[l.state] = (counts[l.state] ?? 0) + 1;
  }

  const edits = await db.select().from(draftEdits);
  const avgEditRatio =
    edits.length === 0
      ? 0
      : edits.reduce((s, e) => s + e.editRatio, 0) / edits.length;
  const majorRewrites = edits.filter((e) => e.editRatio >= 0.3).length;

  const replies = (await db
    .select()
    .from(messages))
    .filter((m) => m.direction === "inbound" && m.classification === "reply")
    .length;

  const sent = Math.max(
    (await db
      .select()
      .from(deliveryEvents))
      .filter((e) => e.eventType === "sent").length,
    allLeads.filter((l) =>
      ["sent", "replied", "in_conversation", "closed_won", "closed_lost"].includes(
        l.state,
      ),
    ).length,
  );

  return {
    stateCounts: counts,
    totalLeads: allLeads.length,
    avgEditRatio,
    majorRewriteRate: edits.length ? majorRewrites / edits.length : 0,
    editedDrafts: edits.length,
    sent,
    replies,
    replyRate: sent ? replies / sent : 0,
    generatedAt: new Date().toISOString(),
  };
}
