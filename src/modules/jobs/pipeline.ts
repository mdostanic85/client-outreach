import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { jobs, settings } from "@/db/schema";
import { getBudgetStatus } from "@/lib/budgets";
import { logger } from "@/lib/logging/logger";
import { collectJobsForProfile } from "@/modules/collectors/run";
import { filterRawJobs } from "@/modules/jobs/filters";
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

  const active = getActiveSearchParams();
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
    profile = requireMatchingProfileJson();
  } catch {
    await report?.(
      progressFor("collect", 100, "Approve your profile first"),
    );
    return { skipped: "no_structured_profile" };
  }

  if (getBudgetStatus().hardStopped) {
    await report?.(
      progressFor("collect", 100, "Monthly AI budget reached"),
    );
    return { skipped: "budget" };
  }

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
    ),
  );
  const filtered = filterRawJobs(collected.raw, active.params);
  const persisted = persistCollectedJobs(filtered.kept, active.version);
  await report?.(
    progressFor(
      "filter",
      62,
      `Kept ${filtered.kept.length} · dropped ${filtered.dropped.length}`,
    ),
  );

  const db = getDb();
  const toEvaluate = db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "active"),
        inArray(jobs.triageState, ["discovered", "published", "saved"]),
      ),
    )
    .all()
    .map((j) => j.id)
    .slice(0, 40);

  const evalResult = await evaluateJobsBatch({
    jobIds: toEvaluate,
    profileVersion: profile.version,
    searchProfileVersion: active.version,
    searchParams: active.params,
    profileJson: profile.profileJson,
    usePortfolioInMatching: profile.usePortfolioInMatching,
    onProgress: report,
  });

  await report?.(
    progressFor("publish", 95, "Building today’s shortlist…"),
  );
  const setting = db.select().from(settings).all()[0];
  const limit = setting?.dailyJobCount ?? 20;
  const published = publishDailyJobList(limit);

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
    ),
  );

  logger.info(stats, "job discovery pipeline complete");
  return stats;
}
