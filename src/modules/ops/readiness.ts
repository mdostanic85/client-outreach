import { getDb } from "@/db/client";
import { draftEdits, drafts, leads, syncRuns } from "@/db/schema";
import { getBudgetStatus } from "@/lib/budgets";
import { getLearningGates } from "@/modules/learning/gates";
import { getUserSettings, updateUserSettings } from "@/modules/settings/user-settings";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  detail: string;
  source: "auto" | "manual";
};

export type ValidationReadiness = {
  phase1: ChecklistItem[];
  phase2: ChecklistItem[];
  phase3Ops: ChecklistItem[];
  phase4Gates: ChecklistItem[];
  consecutiveUsableRuns: number;
  suggestedToday: number;
  acceptRate: number | null;
  majorRewriteRate: number;
  costOk: boolean;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Count trailing consecutive calendar days with a finished worker run and no error. */
export async function countConsecutiveUsableRuns(): Promise<number> {
  const runs = (await getDb()
    .select()
    .from(syncRuns))
    .filter((r) => r.kind === "daily_pipeline" || r.kind.includes("pipeline"))
    .filter((r) => r.finishedAt && !r.error)
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));

  if (runs.length === 0) {
    const any = (await getDb()
      .select()
      .from(syncRuns))
      .filter((r) => r.finishedAt && !r.error)
      .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
    return streakFromRuns(any);
  }
  return streakFromRuns(runs);
}

function streakFromRuns(
  runs: Array<{ finishedAt: string | null; startedAt: string }>,
): number {
  if (runs.length === 0) return 0;
  const days = [...new Set(runs.map((r) => dayKey(r.finishedAt ?? r.startedAt)))].sort(
    (a, b) => b.localeCompare(a),
  );
  if (days.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(`${days[i - 1]}T00:00:00Z`);
    const cur = new Date(`${days[i]}T00:00:00Z`);
    const diffDays = (prev.getTime() - cur.getTime()) / (24 * 60 * 60 * 1000);
    if (diffDays === 1) streak += 1;
    else break;
  }
  return streak;
}

export type OpsChecklist = {
  productValidated: boolean;
  dedicatedMailbox: boolean;
  spfConfirmed: boolean;
  dkimConfirmed: boolean;
  dmarcReviewed: boolean;
  manualLowVolumePracticed: boolean;
  notes?: string;
};

export const DEFAULT_OPS_CHECKLIST: OpsChecklist = {
  productValidated: false,
  dedicatedMailbox: false,
  spfConfirmed: false,
  dkimConfirmed: false,
  dmarcReviewed: false,
  manualLowVolumePracticed: false,
};

export function parseOpsChecklist(json: string | null | undefined): OpsChecklist {
  try {
    return { ...DEFAULT_OPS_CHECKLIST, ...(JSON.parse(json || "{}") as OpsChecklist) };
  } catch {
    return { ...DEFAULT_OPS_CHECKLIST };
  }
}

/** Ticks or unticks items on the owner's ops checklist (Admin → Validation readiness). */
export async function updateOpsChecklist(patch: Partial<OpsChecklist>): Promise<void> {
  const current = parseOpsChecklist((await getUserSettings()).opsChecklistJson);
  await updateUserSettings({ opsChecklistJson: JSON.stringify({ ...current, ...patch }) });
}

export async function getValidationReadiness(ops: OpsChecklist): Promise<ValidationReadiness> {
  const db = getDb();
  const allLeads = await db.select().from(leads);
  const suggested = allLeads.filter((l) =>
    ["suggested", "researched", "saved_for_later"].includes(l.state),
  );
  const decided = allLeads.filter((l) =>
    ["accepted", "rejected", "suppressed", "draft_ready", "sent", "replied"].includes(
      l.state,
    ),
  );
  const accepted = allLeads.filter((l) =>
    ["accepted", "draft_ready", "sent", "replied", "follow_up_due", "in_conversation"].includes(
      l.state,
    ),
  );
  const acceptRate =
    decided.length === 0 ? null : accepted.length / Math.max(1, decided.length);

  const today = new Date().toISOString().slice(0, 10);
  const suggestedToday = allLeads.filter(
    (l) =>
      l.publishedAt?.startsWith(today) ||
      (l.state === "suggested" && l.createdAt.startsWith(today)),
  ).length;

  const edits = await db.select().from(draftEdits);
  const majorRewriteRate =
    edits.length === 0
      ? 0
      : edits.filter((e) => e.editRatio >= 0.3).length / edits.length;

  const draftCount = (await db.select().from(drafts)).length;
  const budget = await getBudgetStatus();
  const consecutive = await countConsecutiveUsableRuns();
  const gates = await getLearningGates();

  const phase1: ChecklistItem[] = [
    {
      id: "p1-runs",
      label: "Five consecutive usable daily runs",
      done: consecutive >= 5,
      detail: `${consecutive}/5 consecutive finished runs`,
      source: "auto",
    },
    {
      id: "p1-volume",
      label: "10–15 visible leads/day when sources allow",
      done: suggestedToday >= 10 || suggested.length >= 10,
      detail: `Today published/suggested signal: ${suggestedToday}; open suggested: ${suggested.length}`,
      source: "auto",
    },
    {
      id: "p1-worth",
      label: "≥50% judged worth reviewing (accept vs decided)",
      done: acceptRate != null && acceptRate >= 0.5,
      detail:
        acceptRate == null
          ? "No accept/reject decisions yet"
          : `${(acceptRate * 100).toFixed(0)}% accepted of decided (${accepted.length}/${decided.length})`,
      source: "auto",
    },
    {
      id: "p1-claims",
      label: "Unsupported claims <5%",
      done: false,
      detail: "Human judgment during review — mark in notes when confirmed",
      source: "manual",
    },
    {
      id: "p1-time",
      label: "Daily review ≤15 minutes",
      done: false,
      detail: "Time yourself for a week — manual confirmation",
      source: "manual",
    },
    {
      id: "p1-cost",
      label: "AI cost visible and below hard limit",
      done: !budget.hardStopped && budget.budgetUsd > 0,
      detail: `$${budget.spentUsd.toFixed(2)} / $${budget.budgetUsd}${budget.alerts.length ? ` · alerts: ${budget.alerts.join(", ")}` : ""}`,
      source: "auto",
    },
  ];

  const phase2: ChecklistItem[] = [
    {
      id: "p2-drafts",
      label: "20 real drafts evaluated",
      done: draftCount >= 20 && majorRewriteRate < 0.35,
      detail: `${draftCount} drafts · major rewrite rate ${(majorRewriteRate * 100).toFixed(0)}% (target <30%). Run npm run eval:writing and score offline.`,
      source: "auto",
    },
    {
      id: "p2-rewrite",
      label: "<20–30% require major rewrite",
      done: edits.length >= 5 && majorRewriteRate < 0.3,
      detail:
        edits.length < 5
          ? `Need more edit samples (${edits.length}/5+)`
          : `${(majorRewriteRate * 100).toFixed(0)}% major rewrites`,
      source: "auto",
    },
  ];

  const phase3Ops: ChecklistItem[] = [
    {
      id: "p3-validated",
      label: "Product validated before live sending",
      done: ops.productValidated,
      detail: "Confirm Phase 1/2 quality gates manually",
      source: "manual",
    },
    {
      id: "p3-mailbox",
      label: "Dedicated outreach mailbox",
      done: ops.dedicatedMailbox,
      detail: "Separate from personal inbox",
      source: "manual",
    },
    {
      id: "p3-spf",
      label: "SPF confirmed",
      done: ops.spfConfirmed,
      detail: "DNS TXT for sending domain",
      source: "manual",
    },
    {
      id: "p3-dkim",
      label: "DKIM confirmed",
      done: ops.dkimConfirmed,
      detail: "Provider DKIM signatures verifying",
      source: "manual",
    },
    {
      id: "p3-dmarc",
      label: "DMARC published and reviewed",
      done: ops.dmarcReviewed,
      detail: "Start with p=none if new",
      source: "manual",
    },
    {
      id: "p3-practice",
      label: "Manual low-volume sending practiced",
      done: ops.manualLowVolumePracticed,
      detail: "Send a few by hand on the dedicated box first",
      source: "manual",
    },
  ];

  const phase4Gates: ChecklistItem[] = [
    {
      id: "p4-days",
      label: "≥30 days of signals",
      done: gates.daysOfSignals >= 30,
      detail: `${gates.daysOfSignals}/30 days`,
      source: "auto",
    },
    {
      id: "p4-edits",
      label: "≥20 edited drafts",
      done: gates.editedDrafts >= 20,
      detail: `${gates.editedDrafts}/20`,
      source: "auto",
    },
    {
      id: "p4-delivered",
      label: "≥50 delivered (or meaningful smaller sample)",
      done: gates.deliveredMessages >= 50 || gates.ready,
      detail: `${gates.deliveredMessages}/50 delivered · gates ready: ${gates.ready}`,
      source: "auto",
    },
  ];

  return {
    phase1,
    phase2,
    phase3Ops,
    phase4Gates,
    consecutiveUsableRuns: consecutive,
    suggestedToday,
    acceptRate,
    majorRewriteRate,
    costOk: !budget.hardStopped,
  };
}
