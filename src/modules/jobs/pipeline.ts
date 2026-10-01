import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobs } from "@/db/schema";
import { getBudgetStatus } from "@/lib/budgets";
import { logger } from "@/lib/logging/logger";
import { collectJobsForProfile } from "@/modules/collectors/run";
import { filterRawJobs, type FilterDropReason } from "@/modules/jobs/filters";
import { rankForEvaluation } from "@/modules/jobs/evaluation-order";
import { persistCollectedJobs } from "@/modules/jobs/persist";
import {
  progressFor,
  type JobSearchProgressCallback,
} from "@/modules/jobs/progress";
import {
  evaluateJobsBatch,
  publishDailyJobList,
  requireMatchingProfileJson,
} from "@/modules/matching/evaluate";
import { getActiveSearchParams } from "@/modules/search-profile/queries";
import { getUserSettings } from "@/modules/settings/user-settings";
import { owned } from "@/modules/auth/current-user";

/** Jobs the AI scores per run (cached matches cost nothing). */
const EVALUATION_BUDGET = 40;

/** Stay under the 300s function limit so the run can still publish and close the stream. */
const PIPELINE_BUDGET_MS = 240_000;

export type JobPipelineStats = {
  skipped?: string;
  raw?: number;
  keptAfterFilter?: number;
  dropped?: number;
  created?: number;
  updated?: number;
  evaluated?: number;
  recommended?: number;
  published?: number;
  publishedStrong?: number;
  publishedWorthALook?: number;
  apifyCostUsd?: number;
};

/**
 * Full job collection → filter → evaluate → publish pipeline.
 * Requires approved search profile + approved structured profile.
 */
export async function runJobDiscoveryPipeline(options?: {
  onProgress?: JobSearchProgressCallback;
}): Promise<JobPipelineStats> {
  const report = options?.onProgress;
  const deadline = Date.now() + PIPELINE_BUDGET_MS;

  const active = await getActiveSearchParams();
  if (!active) {
    logger.info("No approved job search profile — skipping job pipeline");
    await report?.(
      progressFor("collect", 100, "Approve search criteria first"),
    );
    return { skipped: "no_search_profile" };
  }

  let profile: {
    profileJson: string;
    version: number;
    usePortfolioInMatching: boolean;
  };
  try {
    profile = await requireMatchingProfileJson();
  } catch {
    await report?.(
      progressFor("collect", 100, "Approve your profile first"),
    );
    return { skipped: "no_structured_profile" };
  }

  if ((await getBudgetStatus()).hardStopped) {
    await report?.(
      progressFor("collect", 100, "Monthly AI budget reached"),
    );
    return { skipped: "budget" };
  }

  await report?.(
    progressFor(
      "collect",
      2,
      "Understanding your profile…",
      {
        regionOrCategory: active.params.targetTitles[0],
      },
    ),
  );
  await report?.(
    progressFor(
      "collect",
      6,
      "Building search strategy from your criteria…",
      {
        regionOrCategory:
          active.params.targetTitles.slice(0, 2).join(" · ") || undefined,
      },
    ),
  );

  const collected = await collectJobsForProfile({
    params: active.params,
    searchProfileVersion: active.version,
    onProgress: report,
  });

  await report?.(
    progressFor(
      "filter",
      58,
      `Filtering ${collected.raw.length} openings…`,
      {
        reviewed: collected.raw.length,
        regionOrCategory: active.params.targetTitles[0],
      },
    ),
  );
  const filtered = filterRawJobs(collected.raw, active.params);
  // Persisted in scoring order, so the AI budget goes to the best matches.
  const ranked = rankForEvaluation(filtered.kept, active.params);
  const persisted = await persistCollectedJobs(ranked, active.version);
  await report?.(
    progressFor(
      "filter",
      62,
      `Kept ${filtered.kept.length} · dropped ${filtered.dropped.length}`,
      {
        reviewed: collected.raw.length,
        removed: filtered.dropped.length,
        promising: filtered.kept.length,
        regionOrCategory: active.params.targetTitles[0],
      },
      {
        kind: "filter",
        label: `Removed ${filtered.dropped.length} of ${collected.raw.length}`,
        meta: summarizeDropReasons(filtered.dropped.map((d) => d.reason)) || "Nothing removed",
        value: `${filtered.kept.length} kept`,
        tone: filtered.kept.length > 0 ? "neutral" : "weak",
      },
    ),
  );

  const db = getDb();
  const evaluable = new Set(
    (await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(await owned(jobs),
          eq(jobs.status, "active"),
          inArray(jobs.id, persisted.jobIds),
          inArray(jobs.triageState, ["discovered", "published", "saved"]),
        ),
      ))
      .map((j) => j.id),
  );
  // Keep the ranking: a database `IN` returns rows in no particular order.
  const toEvaluate = [...new Set(persisted.jobIds)]
    .filter((id) => evaluable.has(id))
    .slice(0, EVALUATION_BUDGET);

  const evalResult = await evaluateJobsBatch({
    jobIds: toEvaluate,
    profileVersion: profile.version,
    searchProfileVersion: active.version,
    searchParams: active.params,
    profileJson: profile.profileJson,
    usePortfolioInMatching: profile.usePortfolioInMatching,
    onProgress: report,
    deadline,
  });

  await report?.(
    progressFor("publish", 95, "Building today’s shortlist…", {
      reviewed: collected.raw.length,
      removed: filtered.dropped.length,
      promising: evalResult.recommended,
      regionOrCategory: active.params.targetTitles[0],
    }),
  );
  const setting = (await getUserSettings());
  const limit = setting?.dailyJobCount ?? 20;
  const published = await publishDailyJobList(limit, evalResult.evaluatedJobIds, evalResult.matchIds);

  const stats: JobPipelineStats = {
    raw: collected.raw.length,
    keptAfterFilter: filtered.kept.length,
    dropped: filtered.dropped.length,
    created: persisted.created,
    updated: persisted.updated,
    evaluated: evalResult.evaluated,
    recommended: evalResult.recommended,
    published: published.published,
    publishedStrong: published.strong,
    publishedWorthALook: published.worthALook,
    apifyCostUsd: collected.apifyCostUsd,
  };

  await report?.(
    progressFor(
      "publish",
      100,
      published.published > 0
        ? `${published.strong} strong · ${published.worthALook} worth a look`
        : "No matches to show this run",
      {
        reviewed: collected.raw.length,
        removed: filtered.dropped.length,
        promising: published.strong + published.worthALook,
        regionOrCategory: active.params.targetTitles[0],
      },
    ),
  );

  logger.info(stats, "job discovery pipeline complete");
  return stats;
}

const DROP_REASON_LABELS: Record<FilterDropReason, string> = {
  unrelated_title: "different role",
  excluded_title: "excluded title",
  too_old: "too old",
  bad_location: "location",
  remote_required: "not remote",
  wrong_employment: "employment type",
  wrong_seniority: "seniority",
  excluded_keyword: "excluded keyword",
  duplicate: "duplicate",
  avoid_industry: "industry",
};

/** "18 different role · 4 not remote · 2 duplicate" — top three reasons. */
export function summarizeDropReasons(reasons: FilterDropReason[]): string {
  const counts = new Map<FilterDropReason, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, n]) => `${n} ${DROP_REASON_LABELS[reason]}`)
    .join(" · ");
}
