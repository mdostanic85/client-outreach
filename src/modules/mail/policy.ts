import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { deliveryEvents, settings } from "@/db/schema";
import { getMailboxHealth } from "./approvals";

export type SendPolicy = {
  maxNewPerDay: number;
  weekdaysOnly: boolean;
  maxFollowUps: number;
  /** Days after initial send before follow-up 1 / 2 */
  followUpOffsetsDays: [number, number];
};

export const DEFAULT_SEND_POLICY: SendPolicy = {
  maxNewPerDay: 5,
  weekdaysOnly: true,
  maxFollowUps: 2,
  followUpOffsetsDays: [5, 12],
};

export function getSendPolicy(): SendPolicy {
  const row = getDb().select().from(settings).all()[0];
  let stored: Partial<SendPolicy> = {};
  try {
    stored = JSON.parse(row?.sendPolicyJson || "{}") as Partial<SendPolicy>;
  } catch {
    stored = {};
  }
  return { ...DEFAULT_SEND_POLICY, ...stored };
}

/** Local weekday check (Mon–Fri). */
export function isWeekday(date = new Date()): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function startOfLocalDayIso(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function countNewSendsToday(): number {
  const since = startOfLocalDayIso();
  return getDb()
    .select()
    .from(deliveryEvents)
    .where(
      and(
        eq(deliveryEvents.eventType, "sent"),
        gte(deliveryEvents.occurredAt, since),
      ),
    )
    .all().length;
}

export type SendGateResult =
  | { ok: true }
  | { ok: false; reason: string };

export function checkSendWindow(policy = getSendPolicy()): SendGateResult {
  if (policy.weekdaysOnly && !isWeekday()) {
    return { ok: false, reason: "Send window: weekdays only" };
  }
  return { ok: true };
}

export function checkDailyCap(policy = getSendPolicy()): SendGateResult {
  const sent = countNewSendsToday();
  if (sent >= policy.maxNewPerDay) {
    return {
      ok: false,
      reason: `Daily cap reached (${sent}/${policy.maxNewPerDay})`,
    };
  }
  return { ok: true };
}

export function checkMailboxHealth(): SendGateResult {
  const health = getMailboxHealth();
  if (health.pausedAt) {
    return {
      ok: false,
      reason: `Mailbox paused: ${health.pauseReason ?? "deliverability"}`,
    };
  }
  return { ok: true };
}

/** After two hard bounces in latest 20 new sends → pause. */
export function evaluateBounceHealth(): { shouldPause: boolean; reason?: string } {
  const events = getDb()
    .select()
    .from(deliveryEvents)
    .all()
    .filter((e) => e.eventType === "sent" || e.eventType === "bounce_hard")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const recentSends = events.filter((e) => e.eventType === "sent").slice(0, 20);
  if (recentSends.length === 0) return { shouldPause: false };

  const sendIds = new Set(recentSends.map((e) => e.messageId).filter(Boolean));
  const hardBounces = events.filter(
    (e) =>
      e.eventType === "bounce_hard" &&
      e.messageId &&
      sendIds.has(e.messageId),
  );

  // Also count hard bounces among latest 20 delivery-related events tied to sends
  const recentHard = getDb()
    .select()
    .from(deliveryEvents)
    .all()
    .filter((e) => e.eventType === "bounce_hard")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 20);

  const hardInWindow = Math.max(hardBounces.length, countHardInLatestSends());

  if (hardInWindow >= 2) {
    return {
      shouldPause: true,
      reason: `Deliverability pause: ${hardInWindow} hard bounces in latest 20 new sends`,
    };
  }

  // Rolling rate concerning: ≥20% hard bounce with ≥10 sends
  if (recentSends.length >= 10) {
    const rate = hardInWindow / recentSends.length;
    if (rate >= 0.2) {
      return {
        shouldPause: true,
        reason: `Deliverability pause: hard bounce rate ${(rate * 100).toFixed(0)}%`,
      };
    }
  }

  void recentHard;
  return { shouldPause: false };
}

function countHardInLatestSends(): number {
  const db = getDb();
  const latestSends = db
    .select()
    .from(deliveryEvents)
    .all()
    .filter((e) => e.eventType === "sent")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 20);

  if (latestSends.length === 0) return 0;

  const oldest = latestSends[latestSends.length - 1]?.occurredAt;
  if (!oldest) return 0;

  return db
    .select()
    .from(deliveryEvents)
    .all()
    .filter(
      (e) => e.eventType === "bounce_hard" && e.occurredAt >= oldest,
    ).length;
}
