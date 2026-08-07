import { and, gte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { apiUsage, settings } from "@/db/schema";
import { logger } from "@/lib/logging/logger";

export type BudgetStatus = {
  spentUsd: number;
  budgetUsd: number;
  remainingUsd: number;
  ratio: number;
  alerts: Array<"50%" | "75%" | "90%" | "hard_stop">;
  hardStopped: boolean;
};

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function getMonthSpendUsd(): Promise<number> {
  const db = getDb();
  const row = (await db
    .select({
      total: sql<number>`coalesce(sum(${apiUsage.estimatedCost}), 0)`,
    })
    .from(apiUsage)
    .where(gte(apiUsage.occurredAt, monthStartIso())).limit(1))[0];
  return Number(row?.total ?? 0);
}

export async function getBudgetStatus(): Promise<BudgetStatus> {
  const [setting, spentUsd] = await Promise.all([
    getDb().select().from(settings).limit(1).then((rows) => rows[0]),
    getMonthSpendUsd(),
  ]);
  const budgetUsd = setting?.aiBudgetUsd ?? 8;
  const remainingUsd = Math.max(0, budgetUsd - spentUsd);
  const ratio = budgetUsd > 0 ? spentUsd / budgetUsd : 1;

  const alerts: BudgetStatus["alerts"] = [];
  if (ratio >= 1) alerts.push("hard_stop");
  else if (ratio >= 0.9) alerts.push("90%");
  else if (ratio >= 0.75) alerts.push("75%");
  else if (ratio >= 0.5) alerts.push("50%");

  return {
    spentUsd,
    budgetUsd,
    remainingUsd,
    ratio,
    alerts,
    hardStopped: ratio >= 1,
  };
}

/** Throws if public research/triage should stop due to hard budget. */
export async function assertPublicBudgetAllows(task: string) {
  const status = await getBudgetStatus();
  if (status.hardStopped) {
    logger.warn({ task, ...status }, "AI budget hard stop — blocking public LLM");
    throw new Error(
      `AI budget hard stop: spent $${status.spentUsd.toFixed(2)} of $${status.budgetUsd} this month`,
    );
  }
  for (const alert of status.alerts) {
    if (alert !== "hard_stop") {
      logger.warn({ task, alert, ...status }, "AI budget alert");
    }
  }
  return status;
}

export async function canRunPublicLlm(): Promise<boolean> {
  return !(await getBudgetStatus()).hardStopped;
}
