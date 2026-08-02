import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { deliveryEvents, settings } from "@/db/schema";
import { getMailboxHealth } from "./approvals";
import {
  DEFAULT_SEND_POLICY,
  type SendPolicy,
} from "./policy-defaults";

export type { SendPolicy } from "./policy-defaults";
export { DEFAULT_SEND_POLICY } from "./policy-defaults";

export async function getSendPolicy(): Promise<SendPolicy> {
  const row = (await getDb().select().from(settings).limit(1))[0];
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

export async function countNewSendsToday(): Promise<number> {
  const since = startOfLocalDayIso();
  return (
    await getDb()
      .select()
      .from(deliveryEvents)
      .where(
        and(
          eq(deliveryEvents.eventType, "sent"),
          gte(deliveryEvents.occurredAt, since),
        ),
      )
  ).length;
}

export type SendGateResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function checkSendWindow(
  policy?: SendPolicy,
): Promise<SendGateResult> {
  const resolved = policy ?? (await getSendPolicy());
  if (resolved.weekdaysOnly && !isWeekday()) {
    return { ok: false, reason: "Send window: weekdays only" };
  }
  return { ok: true };
}

export async function checkDailyCap(
  policy?: SendPolicy,
): Promise<SendGateResult> {
  const resolved = policy ?? (await getSendPolicy());
  const sent = await countNewSendsToday();
  if (sent >= resolved.maxNewPerDay) {
    return {
      ok: false,
      reason: `Daily cap reached (${sent}/${resolved.maxNewPerDay})`,
    };
  }
  return { ok: true };
}

export async function checkMailboxHealth(): Promise<SendGateResult> {
  const health = await getMailboxHealth();
  if (health.pausedAt) {
    return {
      ok: false,
      reason: `Mailbox paused: ${health.pauseReason ?? "deliverability"}`,
    };
  }
  return { ok: true };
}

/** After two hard bounces in latest 20 new sends → pause. */
export async function evaluateBounceHealth(): Promise<{
  shouldPause: boolean;
  reason?: string;
}> {
  const events = (
    await getDb().select().from(deliveryEvents)
  )
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

  const recentHard = (
    await getDb().select().from(deliveryEvents)
  )
    .filter((e) => e.eventType === "bounce_hard")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 20);

  const hardInWindow = Math.max(hardBounces.length, await countHardInLatestSends());

  if (hardInWindow >= 2) {
    return {
      shouldPause: true,
      reason: `Deliverability pause: ${hardInWindow} hard bounces in latest 20 new sends`,
    };
  }

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

async function countHardInLatestSends(): Promise<number> {
  const db = getDb();
  const latestSends = (await db.select().from(deliveryEvents))
    .filter((e) => e.eventType === "sent")
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 20);

  if (latestSends.length === 0) return 0;

  const oldest = latestSends[latestSends.length - 1]?.occurredAt;
  if (!oldest) return 0;

  return (await db.select().from(deliveryEvents)).filter(
    (e) => e.eventType === "bounce_hard" && e.occurredAt >= oldest,
  ).length;
}
