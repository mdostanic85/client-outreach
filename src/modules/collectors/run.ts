import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { collectorRuns } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import type { JobSearchParams, JobSource } from "@/modules/search-profile/schemas";
import { collectAtsBoardsViaApify, collectViaApify, getApifyToken } from "./apify";
import { collectArbeitnow } from "./arbeitnow";
import { collectRemotive } from "./remotive";
import type { CollectorQuery, RawCollectedJob } from "./types";

const FREE_SOURCES = new Set<JobSource>(["remotive", "arbeitnow"]);
const ATS_SOURCES = new Set<JobSource>(["greenhouse", "lever", "ashby", "apify"]);

/** Free-API queries: one per title (not every location). */
export function expandFreeQueries(params: JobSearchParams): CollectorQuery[] {
  const titles = params.targetTitles.slice(0, 5);
  const sources = params.sourcesEnabled.filter((s) => FREE_SOURCES.has(s));
  const queries: CollectorQuery[] = [];
  for (const source of sources) {
    for (const title of titles) {
      queries.push({
        title,
        location: params.locations[0] ?? "Remote",
        keywords: params.searchKeywords,
        postedWithinHours: params.postedWithinHours,
        maxResults: params.maxResultsPerQuery,
        source,
      });
    }
  }
  return queries;
}

async function runOneQuery(
  query: CollectorQuery,
  searchProfileVersion: number,
): Promise<{ jobs: RawCollectedJob[]; costUsd: number }> {
  const runId = newId("crun");
  const db = getDb();
  db.insert(collectorRuns)
    .values({
      id: runId,
      searchProfileVersion,
      source: query.source,
      queryJson: JSON.stringify(query),
      startedAt: nowIso(),
      status: "running",
    })
    .run();

  try {
    let jobs: RawCollectedJob[] = [];
    let costUsd = 0;

    if (query.source === "remotive") {
      jobs = await collectRemotive(query);
    } else if (query.source === "arbeitnow") {
      jobs = await collectArbeitnow(query);
    } else {
      const result = await collectViaApify(query);
      jobs = result.jobs;
      costUsd = result.costUsd;
    }

    db.update(collectorRuns)
      .set({
        finishedAt: nowIso(),
        resultCount: jobs.length,
        costUsd,
        status: "ok",
      })
      .where(eq(collectorRuns.id, runId))
      .run();

    return { jobs, costUsd };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.update(collectorRuns)
      .set({
        finishedAt: nowIso(),
        status: "error",
        error: message.slice(0, 500),
      })
      .where(eq(collectorRuns.id, runId))
      .run();
    logger.warn({ err, query }, "collector query failed");
    return { jobs: [], costUsd: 0 };
  }
}

/**
 * Run focused collectors for an approved search profile.
 * - Remotive/Arbeitnow: title queries (free)
 * - Apify ATS: one batched board scrape with keywordFilter (needs APIFY_TOKEN)
 */
export async function collectJobsForProfile(options: {
  params: JobSearchParams;
  searchProfileVersion: number;
}): Promise<{
  raw: RawCollectedJob[];
  queryCount: number;
  apifyCostUsd: number;
}> {
  const raw: RawCollectedJob[] = [];
  const seen = new Set<string>();
  let apifyCostUsd = 0;
  let queryCount = 0;

  const pushJobs = (jobs: RawCollectedJob[]) => {
    for (const job of jobs) {
      const k = `${job.source}|${job.externalId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      raw.push(job);
      if (raw.length >= options.params.maxDailyRawJobs) break;
    }
  };

  // 1) Free APIs
  const freeQueries = expandFreeQueries(options.params);
  queryCount += freeQueries.length;
  for (const query of freeQueries) {
    if (raw.length >= options.params.maxDailyRawJobs) break;
    const result = await runOneQuery(query, options.searchProfileVersion);
    pushJobs(result.jobs);
  }

  // 2) Apify ATS — one run per primary target title (capped), if ATS sources enabled
  const wantsAts = options.params.sourcesEnabled.some((s) => ATS_SOURCES.has(s));
  if (wantsAts && getApifyToken() && apifyCostUsd < options.params.maxDailyApifyUsd) {
    const titles = options.params.targetTitles.slice(0, 3);
    for (const title of titles) {
      if (raw.length >= options.params.maxDailyRawJobs) break;
      if (apifyCostUsd >= options.params.maxDailyApifyUsd) break;

      const remaining = Math.max(
        5,
        Math.min(
          options.params.maxResultsPerQuery * 2,
          options.params.maxDailyRawJobs - raw.length,
        ),
      );

      const runId = newId("crun");
      const db = getDb();
      db.insert(collectorRuns)
        .values({
          id: runId,
          searchProfileVersion: options.searchProfileVersion,
          source: "apify",
          queryJson: JSON.stringify({
            mode: "ats_boards",
            titleFilter: title,
            boards: options.params.atsBoardUrls?.length ?? 0,
          }),
          startedAt: nowIso(),
          status: "running",
        })
        .run();

      try {
        const result = await collectAtsBoardsViaApify({
          params: options.params,
          titleFilter: title,
          maxItems: remaining,
        });
        apifyCostUsd += result.costUsd;
        queryCount += 1;
        pushJobs(result.jobs);

        db.update(collectorRuns)
          .set({
            finishedAt: nowIso(),
            resultCount: result.jobs.length,
            costUsd: result.costUsd,
            status: "ok",
          })
          .where(eq(collectorRuns.id, runId))
          .run();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        db.update(collectorRuns)
          .set({
            finishedAt: nowIso(),
            status: "error",
            error: message.slice(0, 500),
          })
          .where(eq(collectorRuns.id, runId))
          .run();
        logger.warn({ err, title }, "Apify ATS collect failed");
      }
    }
  } else if (wantsAts && !getApifyToken()) {
    logger.info(
      "ATS sources enabled but APIFY_TOKEN missing — using Remotive/Arbeitnow only",
    );
  }

  logger.info(
    {
      queryCount,
      raw: raw.length,
      apifyCostUsd,
    },
    "job collection finished",
  );

  return { raw, queryCount, apifyCostUsd };
}
