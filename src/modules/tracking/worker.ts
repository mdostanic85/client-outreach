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
import {
  companyProgressFor,
  type CompanySearchProgressCallback,
} from "@/modules/companies/progress";
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

async function loadSettings() {
  return (await getDb().select().from(settings).limit(1))[0]!;
}

async function saveCheckpoint(
  runId: string,
  checkpoint: Checkpoint,
  stats: RunStats,
  error?: string,
) {
  await getDb()
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
    .where(eq(syncRuns.id, runId));
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
  /** When true, skip nested job discovery (Find Companies UI). */
  skipJobs?: boolean;
  onProgress?: CompanySearchProgressCallback;
}) {
  await ensureDb();
  const db = getDb();
  const setting = await loadSettings();
  const maxResearch = options?.maxResearch ?? setting.dailyLeadCount ?? 12;
  const report = options?.onProgress;

  let runId = options?.resumeRunId;
  let checkpoint: Checkpoint = { completedStages: [] };
  let stats: RunStats = {};

  if (runId) {
    const existing = (await db.select().from(syncRuns).where(eq(syncRuns.id, runId)).limit(1))[0];
    if (!existing) throw new Error(`sync_run not found: ${runId}`);
    checkpoint = JSON.parse(existing.checkpointJson || "{}") as Checkpoint;
    stats = JSON.parse(existing.statsJson || "{}") as RunStats;
    logger.info({ runId, checkpoint }, "Resuming worker run");
  } else {
    runId = newId("run");
    await db.insert(syncRuns)
      .values({
        id: runId,
        kind: "daily_pipeline",
        startedAt: nowIso(),
        checkpointJson: JSON.stringify(checkpoint),
        statsJson: "{}",
      });
  }

  try {
    await report?.(
      companyProgressFor(
        "discover",
        4,
        "Understanding your targeting preferences…",
      ),
    );
    await report?.(
      companyProgressFor(
        "discover",
        10,
        "Building company search strategy…",
      ),
    );

    if (!stageDone(checkpoint, "deterministic_filter")) {
      await report?.(
        companyProgressFor(
          "discover",
          18,
          "Searching company and hiring sources…",
        ),
      );
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

      const sourceErrors = discovered.sourceErrors ?? [];
      await report?.(
        companyProgressFor(
          "discover",
          35,
          sourceErrors.length > 0
            ? `Found ${discovered.filterStats.raw} · ${sourceErrors.length} source issue${sourceErrors.length === 1 ? "" : "s"}`
            : `Found ${discovered.filterStats.raw} candidates · kept ${discovered.filterStats.kept}`,
          {
            reviewed: discovered.filterStats.raw,
            removed: discovered.filterStats.raw - discovered.filterStats.kept,
            promising: discovered.filterStats.kept,
            sourcesActive:
              sourceErrors.length > 0
                ? sourceErrors.slice(0, 3).map((e) => e.source)
                : undefined,
          },
        ),
      );
    }

    if (!stageDone(checkpoint, "llm_triage_batch")) {
      assertPublicBudgetAllows("triage");

      await report?.(
        companyProgressFor(
          "triage",
          40,
          "Reviewing companies against fit criteria…",
          {
            reviewed: Number(stats.rawCandidates ?? 0) || undefined,
            removed: Number(stats.deterministicallyRemoved ?? 0) || undefined,
          },
        ),
      );

      // Retry triage_failed as well — a missing key / transient LLM error
      // previously left leads stuck forever because only `new` was selected.
      const pendingLeads = await db
        .select({ lead: leads, company: companies })
        .from(leads)
        .innerJoin(companies, eq(leads.companyId, companies.id))
        .where(inArray(leads.state, ["new", "triage_failed"]));

      const candidates: FilteredCandidate[] = [];
      const leadIdsByCompanyKey = new Map<string, string>();

      for (const { lead, company } of pendingLeads) {
        const companyKey = company.domain ?? company.normalizedName;
        leadIdsByCompanyKey.set(companyKey, lead.id);

        const sig = (await db
          .select()
          .from(signals)
          .where(eq(signals.companyId, company.id)).limit(1))[0];

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
          await db.update(leads)
            .set({
              state: "rejected",
              rejectReason: "triage_rejected",
              updatedAt: nowIso(),
            })
            .where(eq(leads.id, leadId));
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

      const removed =
        (Number(stats.deterministicallyRemoved ?? 0) || 0) +
        triage.rejected.length;
      await report?.(
        companyProgressFor(
          "triage",
          55,
          `Qualified ${triage.kept.length} · removed ${triage.rejected.length}`,
          {
            reviewed: candidates.length,
            removed,
            promising: triage.kept.length,
          },
        ),
      );
    }

    if (!stageDone(checkpoint, "research_and_score_batch")) {
      const budget = await getBudgetStatus();
      if (budget.hardStopped) {
        stats.researchSkippedBudget = true;
        markStage(checkpoint, "retrieve_pages");
        markStage(checkpoint, "research_and_score_batch");
        saveCheckpoint(runId, checkpoint, stats);
        await report?.(
          companyProgressFor(
            "research",
            80,
            "Research paused — monthly AI budget reached",
          ),
        );
      } else {
        const ids = (checkpoint.companyIdsForResearch ?? []).slice(0, maxResearch);
        let researched = 0;
        let incomplete = 0;

        await report?.(
          companyProgressFor(
            "research",
            58,
            ids.length > 0
              ? `Researching ${ids.length} companies…`
              : "No companies left to research",
            {
              promising: ids.length,
              reviewed: Number(stats.rawCandidates ?? 0) || undefined,
              removed: Number(stats.deterministicallyRemoved ?? 0) || undefined,
            },
          ),
        );

        for (const companyId of ids) {
          if ((await getBudgetStatus()).hardStopped) break;
          try {
            const result = await researchCompany(companyId);
            researched += 1;
            if (result.researchStatus === "incomplete") incomplete += 1;
          } catch (err) {
            logger.error({ companyId, err }, "Research failed for company");
            incomplete += 1;
          }
          await report?.(
            companyProgressFor(
              "research",
              58 + Math.round((researched / Math.max(ids.length, 1)) * 24),
              `Researched ${researched}/${ids.length}`,
              {
                reviewed: researched,
                promising: researched - incomplete,
                removed:
                  (Number(stats.deterministicallyRemoved ?? 0) || 0) +
                  (Number(stats.triageRejected ?? 0) || 0),
              },
            ),
          );
        }

        stats.researched = researched;
        stats.incompleteBriefs = incomplete;
        markStage(checkpoint, "retrieve_pages");
        markStage(checkpoint, "research_and_score_batch");
        saveCheckpoint(runId, checkpoint, stats);
      }
    }

    if (!stageDone(checkpoint, "publish_daily_list")) {
      await report?.(
        companyProgressFor("rank", 88, "Ranking the strongest companies…", {
          promising: Number(stats.researched ?? stats.passedTriage ?? 0) || undefined,
          removed:
            (Number(stats.deterministicallyRemoved ?? 0) || 0) +
            (Number(stats.triageRejected ?? 0) || 0),
        }),
      );

      const dailyCount = setting.dailyLeadCount ?? 12;
      const ranked = (await db
        .select({ lead: leads, company: companies })
        .from(leads)
        .innerJoin(companies, eq(leads.companyId, companies.id))
        .where(eq(leads.state, "suggested")))
        .sort((a, b) => (b.lead.score ?? 0) - (a.lead.score ?? 0))
        .slice(0, dailyCount);

      const now = nowIso();
      for (const row of ranked) {
        await db.update(leads)
          .set({ publishedAt: now, updatedAt: now })
          .where(eq(leads.id, row.lead.id));
      }

      stats.published = ranked.length;
      stats.publishedLeadIds = ranked.map((r) => r.lead.id);
      markStage(checkpoint, "rank");
      markStage(checkpoint, "publish_daily_list");
      saveCheckpoint(runId, checkpoint, stats);

      await report?.(
        companyProgressFor(
          "publish",
          96,
          ranked.length > 0
            ? `Preparing ${ranked.length} recommendations…`
            : "No strong companies to show this run",
          {
            promising: ranked.length,
            removed:
              (Number(stats.deterministicallyRemoved ?? 0) || 0) +
              (Number(stats.triageRejected ?? 0) || 0),
            reviewed: Number(stats.rawCandidates ?? 0) || undefined,
          },
        ),
      );
    }

    if (!stageDone(checkpoint, "record_usage")) {
      stats.budget = await getBudgetStatus();
      markStage(checkpoint, "record_usage");
      saveCheckpoint(runId, checkpoint, stats);
    }

    // Job discovery (requires approved search profile) — skip from Find Companies UI
    if (!options?.skipJobs) {
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
    }

    await report?.(
      companyProgressFor(
        "publish",
        100,
        Number(stats.published ?? 0) > 0
          ? `${stats.published} companies ready`
          : "Search finished",
        {
          promising: Number(stats.published ?? 0) || undefined,
          reviewed: Number(stats.rawCandidates ?? 0) || undefined,
          removed:
            (Number(stats.deterministicallyRemoved ?? 0) || 0) +
            (Number(stats.triageRejected ?? 0) || 0),
        },
      ),
    );

    await db.update(syncRuns)
      .set({ finishedAt: nowIso() })
      .where(eq(syncRuns.id, runId));

    logger.info({ runId, stats }, "Worker pipeline complete");
    return { runId, stats, checkpoint };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    saveCheckpoint(runId, checkpoint, stats, message);
    logger.error({ runId, err: message }, "Worker pipeline failed");
    throw err;
  }
}

export async function getLatestSyncRun() {
  await ensureDb();
  return (await getDb()
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(1))[0];
}

export async function listSyncRuns(limit = 20) {
  await ensureDb();
  return await getDb()
    .select()
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(limit);
}
