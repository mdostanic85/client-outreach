import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { collectorRuns } from "@/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { logger } from "@/lib/logging/logger";
import type { JobSearchParams, JobSource } from "@/modules/search-profile/schemas";
import {
  canAffordApifyRun,
  collectAtsBoardsViaApify,
  collectViaApify,
  getApifyToken,
} from "./apify";
import {
  collectPercent,
  progressFor,
  type JobSearchProgressCallback,
} from "@/modules/jobs/progress";
import { collectArbeitnow } from "./arbeitnow";
import { collectRemotive } from "./remotive";
import type { CollectorQuery, RawCollectedJob } from "./types";

function queryDetail(query: CollectorQuery): string {
  const source =
    query.source === "helloworld"
      ? "HelloWorld"
      : query.source.charAt(0).toUpperCase() + query.source.slice(1);
  return `${source} · ${query.title} · ${query.location}`;
}

const FREE_SOURCES = new Set<JobSource>(["remotive", "arbeitnow"]);
const ATS_SOURCES = new Set<JobSource>(["greenhouse", "lever", "ashby", "apify"]);
const PAID_BOARD_SOURCES = new Set<JobSource>([
  "linkedin",
  "helloworld",
  "infostud",
]);

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

/**
 * LinkedIn: 2–3 focused queries (not title×location matrix).
 * Budget-aware defaults for US / Europe / Serbia coverage.
 */
export function expandLinkedInQueries(params: JobSearchParams): CollectorQuery[] {
  if (!params.sourcesEnabled.includes("linkedin")) return [];

  const title = params.targetTitles[0];
  if (!title) return [];

  const maxResults = Math.min(15, params.maxResultsPerQuery);
  const base = {
    keywords: params.searchKeywords,
    postedWithinHours: params.postedWithinHours,
    maxResults,
    source: "linkedin" as const,
  };

  const queries: CollectorQuery[] = [];
  const remoteLoc =
    params.locations.find((l) => /remote|europe|emea/i.test(l)) ?? "Remote";

  queries.push({ ...base, title, location: remoteLoc });

  // US coverage — largest remote market; LinkedIn workplaceType=remote filters onsite noise
  queries.push({ ...base, title, location: "United States" });

  if (params.locations.some((l) => /serbia|belgrade|balkan/i.test(l))) {
    queries.push({ ...base, title, location: "Serbia" });
  } else if (params.targetTitles[1]) {
    queries.push({
      ...base,
      title: params.targetTitles[1]!,
      location: remoteLoc,
    });
  }

  // Dedupe identical title|location pairs, hard-cap at 3
  const seen = new Set<string>();
  return queries.filter((q) => {
    const k = `${q.title}|${q.location}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 3);
}

/** HelloWorld (daily) + Infostud (only when explicitly enabled). */
export function expandRegionalQueries(params: JobSearchParams): CollectorQuery[] {
  const title = params.targetTitles[0];
  if (!title) return [];

  const maxResults = Math.min(15, params.maxResultsPerQuery);
  const serbiaLoc =
    params.locations.find((l) => /serbia|belgrade/i.test(l)) ?? "Belgrade";
  const queries: CollectorQuery[] = [];

  if (params.sourcesEnabled.includes("helloworld")) {
    queries.push({
      title,
      location: serbiaLoc,
      keywords: params.searchKeywords,
      postedWithinHours: params.postedWithinHours,
      maxResults,
      source: "helloworld",
    });
  }

  if (params.sourcesEnabled.includes("infostud")) {
    queries.push({
      title,
      location: serbiaLoc,
      keywords: params.searchKeywords,
      postedWithinHours: params.postedWithinHours,
      maxResults,
      source: "infostud",
    });
  }

  return queries;
}

async function runOneQuery(
  query: CollectorQuery,
  searchProfileVersion: number,
  params: JobSearchParams,
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
      const result = await collectViaApify(query, {
        remoteRequired: params.remoteRequired,
        seniority: params.seniority,
      });
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
 *
 * Daily mix (target ≤ $0.50 Apify):
 * 1. Remotive / Arbeitnow — free baseline
 * 2. ATS boards — one batched run (primary title)
 * 3. LinkedIn — 2–3 focused queries
 * 4. HelloWorld (+ Infostud if enabled) — regional
 */
export async function collectJobsForProfile(options: {
  params: JobSearchParams;
  searchProfileVersion: number;
  onProgress?: JobSearchProgressCallback;
}): Promise<{
  raw: RawCollectedJob[];
  queryCount: number;
  apifyCostUsd: number;
}> {
  const raw: RawCollectedJob[] = [];
  const seen = new Set<string>();
  let apifyCostUsd = 0;
  let queryCount = 0;
  const budget = options.params.maxDailyApifyUsd;
  const report = options.onProgress;

  const pushJobs = (jobs: RawCollectedJob[]) => {
    for (const job of jobs) {
      const k = `${job.source}|${job.externalId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      raw.push(job);
      if (raw.length >= options.params.maxDailyRawJobs) break;
    }
  };

  const roomForJobs = () => raw.length < options.params.maxDailyRawJobs;
  const afford = (source: JobSource | "ats") =>
    canAffordApifyRun(apifyCostUsd, budget, source);

  const freeQueries = expandFreeQueries(options.params);
  const linkedInQueries = expandLinkedInQueries(options.params);
  const regionalQueries = expandRegionalQueries(options.params).filter((q) =>
    PAID_BOARD_SOURCES.has(q.source),
  );
  const wantsAts = options.params.sourcesEnabled.some((s) => ATS_SOURCES.has(s));
  const hasApify = Boolean(getApifyToken());
  const willRunAts = Boolean(wantsAts && hasApify && afford("ats"));
  const linkedInPlanned = hasApify ? linkedInQueries : [];
  const regionalPlanned = hasApify ? regionalQueries : [];
  const collectTotal =
    freeQueries.length +
    (willRunAts ? 1 : 0) +
    linkedInPlanned.length +
    regionalPlanned.length;
  let collectDone = 0;

  const markCollect = async (detail: string) => {
    collectDone += 1;
    queryCount += 1;
    await report?.(
      progressFor(
        "collect",
        collectPercent(collectDone, Math.max(collectTotal, 1)),
        detail,
      ),
    );
  };

  await report?.(
    progressFor(
      "collect",
      0,
      collectTotal > 0
        ? `Starting ${collectTotal} board searches…`
        : "No sources enabled",
    ),
  );

  // 1) Free APIs
  for (const query of freeQueries) {
    if (!roomForJobs()) break;
    await report?.(
      progressFor(
        "collect",
        collectPercent(collectDone, Math.max(collectTotal, 1)),
        queryDetail(query),
      ),
    );
    const result = await runOneQuery(
      query,
      options.searchProfileVersion,
      options.params,
    );
    pushJobs(result.jobs);
    await markCollect(
      `${queryDetail(query)} · ${result.jobs.length} found`,
    );
  }

  // 2) Apify ATS — single run on primary title (quality/$ winner)
  if (willRunAts) {
    const title = options.params.targetTitles[0];
    if (title) {
      const maxItems = Math.max(
        5,
        Math.min(
          40,
          options.params.maxResultsPerQuery * 2,
          options.params.maxDailyRawJobs - raw.length,
        ),
      );
      const boardCount = options.params.atsBoardUrls?.length ?? 0;
      const atsDetail = `ATS boards · ${title} · ${boardCount} pages`;

      await report?.(
        progressFor(
          "collect",
          collectPercent(collectDone, Math.max(collectTotal, 1)),
          atsDetail,
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
            boards: boardCount,
          }),
          startedAt: nowIso(),
          status: "running",
        })
        .run();

      try {
        const result = await collectAtsBoardsViaApify({
          params: options.params,
          titleFilter: title,
          maxItems,
        });
        apifyCostUsd += result.costUsd;
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
        await markCollect(`${atsDetail} · ${result.jobs.length} found`);
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
        await markCollect(`${atsDetail} · failed`);
      }
    }
  } else if (wantsAts && !getApifyToken()) {
    logger.info(
      "ATS sources enabled but APIFY_TOKEN missing — using Remotive/Arbeitnow only",
    );
  }

  // 3) LinkedIn — focused coverage queries
  for (const query of linkedInPlanned) {
    if (!roomForJobs() || !afford("linkedin")) break;
    await report?.(
      progressFor(
        "collect",
        collectPercent(collectDone, Math.max(collectTotal, 1)),
        queryDetail(query),
      ),
    );
    const result = await runOneQuery(
      query,
      options.searchProfileVersion,
      options.params,
    );
    apifyCostUsd += result.costUsd;
    pushJobs(result.jobs);
    await markCollect(
      `${queryDetail(query)} · ${result.jobs.length} found`,
    );
  }

  // 4) Regional boards (HelloWorld daily; Infostud if enabled)
  for (const query of regionalPlanned) {
    if (!roomForJobs() || !afford(query.source)) break;
    await report?.(
      progressFor(
        "collect",
        collectPercent(collectDone, Math.max(collectTotal, 1)),
        queryDetail(query),
      ),
    );
    const result = await runOneQuery(
      query,
      options.searchProfileVersion,
      options.params,
    );
    apifyCostUsd += result.costUsd;
    pushJobs(result.jobs);
    await markCollect(
      `${queryDetail(query)} · ${result.jobs.length} found`,
    );
  }

  if (apifyCostUsd > budget) {
    logger.warn(
      { apifyCostUsd, budget },
      "Apify spend slightly over daily cap after in-flight run",
    );
  }

  await report?.(
    progressFor(
      "collect",
      55,
      `Collected ${raw.length} openings from ${queryCount} searches`,
    ),
  );

  logger.info(
    {
      queryCount,
      raw: raw.length,
      apifyCostUsd,
      budget,
    },
    "job collection finished",
  );

  return { raw, queryCount, apifyCostUsd };
}
