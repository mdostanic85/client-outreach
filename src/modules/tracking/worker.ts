import { desc, eq, inArray } from "drizzle-orm";
import { ensureDb } from "@/db/ensure";
import { getDb } from "@/db/client";
import {
  companies,
  leads,
  settings,
  signals,
  syncRuns,
} from "@/db/schema";
import { assertPublicBudgetAllows, getBudgetStatus } from "@/lib/budgets";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import { discoverBatch } from "@/modules/discovery/persist";
import type { FilteredCandidate } from "@/modules/discovery/filters";
import { triageCandidatesBatch } from "@/modules/discovery/triage";
import { researchCompany } from "@/modules/research/run";

export const WORKER_STAGES = [
  "discover",
  "normalize",
  "deduplicate",
  "deterministic_filter",
  "llm_triage_batch",
  "retrieve_pages",
  "research_and_score_batch",
  "rank",
  "publish_daily_list",
  "record_usage",
] as const;

export type WorkerStage = (typeof WORKER_STAGES)[number];

type RunStats = Record<string, unknown>;

type Checkpoint = {
  completedStages: WorkerStage[];
  companyIdsForResearch?: string[];
  keptCompanyKeys?: string[];
};

function loadSettings() {
  return getDb().select().from(settings).all()[0]!;
}

function saveCheckpoint(
  runId: string,
  checkpoint: Checkpoint,
  stats: RunStats,
  error?: string,
) {
  getDb()
    .update(syncRuns)
    .set({
      checkpointJson: JSON.stringify(checkpoint),
      statsJson: JSON.stringify(stats),
      error: error ?? null,
      finishedAt:
        error || checkpoint.completedStages.includes("record_usage")
          ? nowIso()
          : null,
    })
    .where(eq(syncRuns.id, runId))
    .run();
}

function stageDone(checkpoint: Checkpoint, stage: WorkerStage) {
  return checkpoint.completedStages.includes(stage);
}

function markStage(checkpoint: Checkpoint, stage: WorkerStage) {
  if (!checkpoint.completedStages.includes(stage)) {
    checkpoint.completedStages.push(stage);
  }
}

/**
 * Nightly worker with stage checkpoints. Failed run resumes from last successful stage.
 */
export async function runWorkerPipeline(options?: {
  resumeRunId?: string;
  maxResearch?: number;
}) {
  ensureDb();
  const db = getDb();
  const setting = loadSettings();
  const maxResearch = options?.maxResearch ?? setting.dailyLeadCount ?? 12;

  let runId = options?.resumeRunId;
  let checkpoint: Checkpoint = { completedStages: [] };
  let stats: RunStats = {};

  if (runId) {
    const existing = db.select().from(syncRuns).where(eq(syncRuns.id, runId)).get();
    if (!existing) throw new Error(`sync_run not found: ${runId}`);
    checkpoint = JSON.parse(existing.checkpointJson || "{}") as Checkpoint;
    stats = JSON.parse(existing.statsJson || "{}") as RunStats;
    logger.info({ runId, checkpoint }, "Resuming worker run");
  } else {
    runId = newId("run");
    db.insert(syncRuns)
      .values({
        id: runId,
        kind: "daily_pipeline",
        startedAt: nowIso(),
        checkpointJson: JSON.stringify(checkpoint),
        statsJson: "{}",
      })
      .run();
  }

  try {
    if (!stageDone(checkpoint, "deterministic_filter")) {
      const discovered = await discoverBatch(setting.targetFiltersJson);
      stats.rawCandidates = discovered.filterStats.raw;
      stats.filterStats = discovered.filterStats;
      stats.sourceErrors = discovered.sourceErrors;
      stats.persisted = discovered.persisted.length;
      stats.deterministicallyRemoved =
        discovered.filterStats.raw - discovered.filterStats.kept;

      checkpoint.companyIdsForResearch = [
        ...new Set(discovered.persisted.map((p) => p.companyId)),
      ];

      markStage(checkpoint, "discover");
      markStage(checkpoint, "normalize");
      markStage(checkpoint, "deduplicate");
      markStage(checkpoint, "deterministic_filter");
      saveCheckpoint(runId, checkpoint, stats);
    }

    if (!stageDone(checkpoint, "llm_triage_batch")) {
      assertPublicBudgetAllows("triage");

      // Retry triage_failed as well — a missing key / transient LLM error
      // previously left leads stuck forever because only `new` was selected.
      const pendingLeads = db
        .select({ lead: leads, company: companies })
        .from(leads)
        .innerJoin(companies, eq(leads.companyId, companies.id))
        .where(inArray(leads.state, ["new", "triage_failed"]))
        .all();

      const candidates: FilteredCandidate[] = [];
      const leadIdsByCompanyKey = new Map<string, string>();

      for (const { lead, company } of pendingLeads) {
        const companyKey = company.domain ?? company.normalizedName;
        leadIdsByCompanyKey.set(companyKey, lead.id);

        const sig = db
          .select()
          .from(signals)
          .where(eq(signals.companyId, company.id))
          .all()[0];

        candidates.push({
          companyKey,
          normalizedName: company.normalizedName,
          domain: company.domain ?? undefined,
          signal: sig
            ? {
                source: sig.source as "remotive" | "arbeitnow" | "manual",
                externalId: sig.externalId,
                companyName: company.name,
                companyDomain: company.domain ?? undefined,
                title: sig.title,
                location: company.country ?? undefined,
                sourceUrl: sig.sourceUrl,
                publishedAt: sig.publishedAt ?? undefined,
                rawHash: sig.rawHash,
              }
            : {
                source: "manual",
                externalId: lead.id,
                companyName: company.name,
                companyDomain: company.domain ?? undefined,
                title: "Pending triage",
                location: company.country ?? undefined,
                sourceUrl: company.domain
                  ? `https://${company.domain}`
                  : `lead://${lead.id}`,
                rawHash: lead.id,
              },
        });
      }

      const triage = await triageCandidatesBatch(candidates, {
        leadIdsByCompanyKey,
      });

      stats.passedTriage = triage.kept.length;
      stats.triageRejected = triage.rejected.length;
      stats.triageFailed = triage.failed.length;

      for (const c of triage.rejected) {
        const leadId = leadIdsByCompanyKey.get(c.companyKey);
        if (leadId) {
          db.update(leads)
            .set({
              state: "rejected",
              rejectReason: "triage_rejected",
              updatedAt: nowIso(),
            })
            .where(eq(leads.id, leadId))
            .run();
        }
      }

      checkpoint.keptCompanyKeys = triage.kept.map((c) => c.companyKey);
      checkpoint.companyIdsForResearch = triage.kept
        .map((c) => {
          const row = pendingLeads.find(
            (r) =>
              (r.company.domain ?? r.company.normalizedName) === c.companyKey,
          );
          return row?.company.id;
        })
        .filter((id): id is string => !!id);

      markStage(checkpoint, "llm_triage_batch");
      saveCheckpoint(runId, checkpoint, stats);
    }

    if (!stageDone(checkpoint, "research_and_score_batch")) {
      const budget = getBudgetStatus();
      if (budget.hardStopped) {
        stats.researchSkippedBudget = true;
        markStage(checkpoint, "retrieve_pages");
        markStage(checkpoint, "research_and_score_batch");
        saveCheckpoint(runId, checkpoint, stats);
      } else {
        const ids = (checkpoint.companyIdsForResearch ?? []).slice(0, maxResearch);
        let researched = 0;
        let incomplete = 0;

        for (const companyId of ids) {
          if (getBudgetStatus().hardStopped) break;
          try {
            const result = await researchCompany(companyId);
            researched += 1;
            if (result.researchStatus === "incomplete") incomplete += 1;
          } catch (err) {
            logger.error({ companyId, err }, "Research failed for company");
            incomplete += 1;
          }
        }

        stats.researched = researched;
        stats.incompleteBriefs = incomplete;
        markStage(checkpoint, "retrieve_pages");
        markStage(checkpoint, "research_and_score_batch");
        saveCheckpoint(runId, checkpoint, stats);
      }
    }

    if (!stageDone(checkpoint, "publish_daily_list")) {
      const dailyCount = setting.dailyLeadCount ?? 12;
      const ranked = db
        .select({ lead: leads, company: companies })
        .from(leads)
        .innerJoin(companies, eq(leads.companyId, companies.id))
        .where(eq(leads.state, "suggested"))
        .all()
        .sort((a, b) => (b.lead.score ?? 0) - (a.lead.score ?? 0))
        .slice(0, dailyCount);

      const now = nowIso();
      for (const row of ranked) {
        db.update(leads)
          .set({ publishedAt: now, updatedAt: now })
          .where(eq(leads.id, row.lead.id))
          .run();
      }

      stats.published = ranked.length;
      stats.publishedLeadIds = ranked.map((r) => r.lead.id);
      markStage(checkpoint, "rank");
      markStage(checkpoint, "publish_daily_list");
      saveCheckpoint(runId, checkpoint, stats);
    }

    if (!stageDone(checkpoint, "record_usage")) {
      stats.budget = getBudgetStatus();
      markStage(checkpoint, "record_usage");
      saveCheckpoint(runId, checkpoint, stats);
    }

    // Job discovery (requires approved search profile)
    try {
      const { runJobDiscoveryPipeline } = await import(
        "@/modules/jobs/pipeline"
      );
      stats.jobs = await runJobDiscoveryPipeline();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stats.jobsError = message;
      logger.warn({ err: message }, "Job discovery pipeline failed (non-fatal)");
    }
    saveCheckpoint(runId, checkpoint, stats);

    db.update(syncRuns)
      .set({ finishedAt: nowIso() })
      .where(eq(syncRuns.id, runId))
      .run();

    logger.info({ runId, stats }, "Worker pipeline complete");
    return { runId, stats, checkpoint };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    saveCheckpoint(runId, checkpoint, stats, message);
    logger.error({ runId, err: message }, "Worker pipeline failed");
    throw err;
  }
}

export function getLatestSyncRun() {
  ensureDb();
  return getDb()
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1)
    .all()[0];
}

export function listSyncRuns(limit = 20) {
  ensureDb();
  return getDb()
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(limit)
    .all();
}
