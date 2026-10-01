import { and, eq } from "drizzle-orm";
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
  SOURCE_LABELS,
  type JobSearchProgressCallback,
} from "@/modules/jobs/progress";
import type { SearchActivity } from "@/modules/search-experience/stages";
import { plannedAtsBoards, collectDirectBoard } from "./direct-ats";
import { collectArbeitnow } from "./arbeitnow";
import { collectHelloWorld } from "./helloworld";
import { collectInfostud } from "./infostud";
import { collectJoberty } from "./joberty";
import { collectLinkedIn } from "./linkedin";
import { collectNsz } from "./nsz";
import { collectPoslovi } from "./poslovi";
import { collectRemotive } from "./remotive";
import {
  collectHimalayas,
  collectJobicy,
  collectRemoteOk,
  collectWeWorkRemotely,
  collectWorkingNomads,
} from "./remote-feeds";
import { serbiaSearchPlaces } from "./serbia-places";
import type { CollectorQuery, RawCollectedJob } from "./types";
import { getOccupation } from "@/modules/occupations/catalog";
import { FAMILY_PROFILES } from "@/modules/occupations/families";
import { currentUserId, owned } from "@/modules/auth/current-user";

function queryDetail(query: CollectorQuery): string {
  return `${SOURCE_LABELS[query.source] ?? query.source} · ${query.title} · ${query.location}`;
}

function foundActivity(label: string, meta: string, found: number | null): SearchActivity {
  return {
    kind: "source",
    label,
    meta,
    value: found == null ? "unavailable" : `${found} found`,
    tone: found == null ? "error" : found > 0 ? "neutral" : "weak",
  };
}

function queryActivity(query: CollectorQuery, found: number): SearchActivity {
  return foundActivity(
    SOURCE_LABELS[query.source] ?? query.source,
    `${query.title} · ${query.location}`,
    found,
  );
}

function boardName(slug: string): string {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Free remote boards that publish one feed; one query per search covers them. */
export const REMOTE_FEED_SOURCES = ["remoteok", "himalayas", "jobicy", "weworkremotely", "workingnomads"] as const;

const FREE_SOURCES = new Set<JobSource>(["remotive", "arbeitnow", ...REMOTE_FEED_SOURCES]);

/** Share of the raw budget direct ATS boards may take when other sources are planned. */
export const DIRECT_BOARD_SHARE = 0.6;

/**
 * Share of the raw budget the free API and feed boards (Remotive, Arbeitnow
 * and the remote feeds) may take, split evenly between them. Serbian boards
 * and LinkedIn keep the rest.
 */
export const FREE_BOARD_SHARE = 0.4;

/** Read directly from public pages; LinkedIn may fall back to Apify when blocked. */
const DIRECT_BOARD_SOURCES = new Set<JobSource>([
  "linkedin",
  "helloworld",
  "infostud",
  "poslovi",
  "joberty",
  "nsz",
]);

/** Free-API queries: one per title (not every location). */
export function expandFreeQueries(params: JobSearchParams): CollectorQuery[] {
  const titles = params.targetTitles.slice(0, 5);
  const sources = params.sourcesEnabled.filter((s) => FREE_SOURCES.has(s));
  const queries: CollectorQuery[] = [];
  const categories = params.occupationFamily
    ? FAMILY_PROFILES[params.occupationFamily].remotiveCategories
    : [];
  for (const source of sources) {
    if (source === "remotive") {
      // A family with no Remotive category must not be searched as "design".
      if (params.occupationFamily && categories.length === 0) continue;
      const title = titles[0];
      if (!title) continue;
      const shared = {
        title,
        location: params.locations[0] ?? "Remote",
        keywords: params.searchKeywords,
        postedWithinHours: params.postedWithinHours,
        maxResults: params.maxResultsPerQuery,
        source,
        searchTerms: [...titles.slice(1), ...params.titleSynonyms],
      };
      if (categories.length === 0) {
        queries.push(shared);
      } else {
        for (const remotiveCategory of categories) {
          queries.push({ ...shared, remotiveCategory });
        }
      }
      continue;
    }
    if ((REMOTE_FEED_SOURCES as readonly string[]).includes(source)) {
      // These feeds are not searched by title: one read per source, filtered by every title.
      const title = titles[0];
      if (!title) continue;
      queries.push({
        title,
        location: "Remote",
        keywords: params.searchKeywords,
        postedWithinHours: params.postedWithinHours,
        maxResults: params.maxResultsPerQuery,
        source,
        searchTerms: [...titles.slice(1), ...params.titleSynonyms],
        family: params.occupationFamily,
      });
      continue;
    }
    for (const title of titles) {
      queries.push({
        title,
        location: params.locations[0] ?? "Remote",
        keywords: params.searchKeywords,
        postedWithinHours: params.postedWithinHours,
        maxResults: params.maxResultsPerQuery,
        source,
        searchTerms: params.titleSynonyms,
      });
    }
  }
  return queries;
}

/**
 * LinkedIn: 2–3 focused queries (not title×location matrix), following the
 * person's locations. The US is only searched for remote roles.
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
  const serbia = params.locations.some((l) => /serbia|srbija|belgrade|beograd/i.test(l));

  if (params.remoteRequired) {
    const remoteLoc =
      params.locations.find((l) => /remote|europe|emea/i.test(l)) ?? "Remote";
    queries.push({ ...base, title, location: remoteLoc });
    // Largest remote market; LinkedIn workplaceType=remote filters on-site noise.
    queries.push({ ...base, title, location: "United States" });
    if (serbia) {
      queries.push({ ...base, title, location: "Serbia" });
    } else if (params.targetTitles[1]) {
      queries.push({ ...base, title: params.targetTitles[1]!, location: remoteLoc });
    }
  } else {
    const places = params.locations.filter((l) => !/^remote$/i.test(l.trim()));
    const primary = places[0] ?? "Serbia";
    queries.push({ ...base, title, location: primary });
    if (places[1]) queries.push({ ...base, title, location: places[1] });
    if (params.targetTitles[1]) {
      queries.push({ ...base, title: params.targetTitles[1]!, location: primary });
    }
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

const SERBIAN_LETTERS = /[čćžšđ]/i;
const CYRILLIC = /\p{Script=Cyrillic}/u;

/** Eight terms when the profile has a Serbian name; otherwise four. */
export function regionalTermCap(params: JobSearchParams): number {
  const occ = getOccupation(params.occupationId);
  if (occ?.sr) return 8;
  const extra = params.titleSynonyms.join(" ");
  return SERBIAN_LETTERS.test(extra) || CYRILLIC.test(extra) ? 8 : 4;
}

/**
 * Serbian boards rarely use the exact English senior title, so search the
 * core title and the Serbian name ("Vozač kamiona", "Medicinska sestra"),
 * then let filterRawJobs decide.
 */
export function regionalSearchTerms(params: JobSearchParams): string[] {
  const cores = params.targetTitles
    .map((title) => title.replace(/\b(senior|sr\.?|lead|staff|principal|head of|junior|mid|ai)\b/gi, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const serbian = getOccupation(params.occupationId)?.sr;
  const terms = [
    ...params.targetTitles.slice(0, 1),
    ...cores.slice(0, 1),
    ...(serbian ? [serbian] : []),
    ...cores.slice(1),
    ...params.titleSynonyms,
    ...params.targetTitles.slice(1),
  ];
  const seen = new Set<string>();
  return terms.filter(t => {
    const key = t.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, regionalTermCap(params));
}

/** HelloWorld (daily) + Infostud (only when explicitly enabled). */
export function expandRegionalQueries(params: JobSearchParams): CollectorQuery[] {
  const title = params.targetTitles[0];
  if (!title) return [];
  const searchTerms = regionalSearchTerms(params);

  const maxResults = Math.min(15, params.maxResultsPerQuery);
  const places = serbiaSearchPlaces(params.locations);
  const primary = places[0]?.label ?? "Beograd";
  const queries: CollectorQuery[] = [];
  const base = {
    title,
    keywords: params.searchKeywords,
    postedWithinHours: params.postedWithinHours,
    maxResults,
    searchTerms,
  };

  if (params.sourcesEnabled.includes("helloworld")) {
    queries.push({ ...base, location: primary, source: "helloworld" });
  }
  if (params.sourcesEnabled.includes("joberty")) {
    queries.push({ ...base, location: primary, source: "joberty" });
  }
  if (params.sourcesEnabled.includes("nsz")) {
    queries.push({ ...base, location: "Serbia", source: "nsz" });
  }

  if (params.sourcesEnabled.includes("infostud")) {
    for (const place of places) {
      queries.push({
        ...base,
        location: place.label,
        source: "infostud",
        cityId: place.infostudId,
      });
    }
  }
  if (params.sourcesEnabled.includes("poslovi")) {
    for (const place of places) {
      queries.push({
        ...base,
        location: place.label,
        source: "poslovi",
        cityId: place.posloviId,
      });
    }
  }

  return queries;
}

async function runOneQuery(
  query: CollectorQuery,
  searchProfileVersion: number,
  params: JobSearchParams,
  options: { apifyFallbackAllowed?: boolean } = {},
): Promise<{ jobs: RawCollectedJob[]; costUsd: number }> {
  const runId = newId("crun");
  const db = getDb();
  await db.insert(collectorRuns)
    .values({
      userId: await currentUserId(),
      id: runId,
      searchProfileVersion,
      source: query.source,
      queryJson: JSON.stringify(query),
      startedAt: nowIso(),
      status: "running",
    });

  try {
    let jobs: RawCollectedJob[] = [];
    let costUsd = 0;
    let note: string | null = null;

    if (query.source === "remotive") {
      jobs = await collectRemotive(query);
    } else if (query.source === "arbeitnow") {
      jobs = await collectArbeitnow(query);
    } else if (query.source === "remoteok") {
      jobs = await collectRemoteOk(query);
    } else if (query.source === "himalayas") {
      jobs = await collectHimalayas(query);
    } else if (query.source === "jobicy") {
      jobs = await collectJobicy(query);
    } else if (query.source === "weworkremotely") {
      jobs = await collectWeWorkRemotely(query);
    } else if (query.source === "workingnomads") {
      jobs = await collectWorkingNomads(query);
    } else if (query.source === "helloworld") {
      jobs = await collectHelloWorld(query, params);
    } else if (query.source === "infostud") {
      jobs = await collectInfostud(query, params);
    } else if (query.source === "poslovi") {
      jobs = await collectPoslovi(query, params);
    } else if (query.source === "joberty") {
      jobs = await collectJoberty(query, params);
    } else if (query.source === "nsz") {
      jobs = await collectNsz(query, params);
    } else if (query.source === "linkedin") {
      const direct = await collectLinkedIn(query, params);
      jobs = direct.jobs;
      if (direct.blocked) {
        note = `linkedin guest API blocked after ${direct.cardsSeen} cards / ${jobs.length} postings`;
        // Paid fallback only when the free path was cut short and budget remains.
        if (jobs.length < query.maxResults && options.apifyFallbackAllowed && getApifyToken()) {
          const fallback = await collectViaApify(query, {
            remoteRequired: params.remoteRequired,
            seniority: params.seniority,
          });
          jobs = [...jobs, ...fallback.jobs];
          costUsd = fallback.costUsd;
          note += `; Apify fallback added ${fallback.jobs.length}`;
        }
        logger.warn({ query: queryDetail(query), note }, "LinkedIn direct collect blocked");
      }
    } else {
      const result = await collectViaApify(query, {
        remoteRequired: params.remoteRequired,
        seniority: params.seniority,
      });
      jobs = result.jobs;
      costUsd = result.costUsd;
    }

    await db.update(collectorRuns)
      .set({
        finishedAt: nowIso(),
        resultCount: jobs.length,
        costUsd,
        status: "ok",
        error: note,
      })
      .where(and(await owned(collectorRuns), eq(collectorRuns.id, runId)));

    return { jobs, costUsd };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(collectorRuns)
      .set({
        finishedAt: nowIso(),
        status: "error",
        error: message.slice(0, 500),
      })
      .where(and(await owned(collectorRuns), eq(collectorRuns.id, runId)));
    logger.warn({ err, query }, "collector query failed");
    return { jobs: [], costUsd: 0 };
  }
}

/**
 * Run focused collectors for an approved search profile.
 *
 * Daily mix (free by default; Apify only as an explicit or LinkedIn fallback, ≤ $0.50):
 * 1. Direct public ATS boards, then Remotive / Arbeitnow
 * 2. Optional explicit Apify ATS fallback
 * 3. LinkedIn — 2–3 focused queries via the public guest pages (Apify if blocked)
 * 4. HelloWorld (+ Infostud if enabled) — regional, read directly
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
      if (raw.length >= options.params.maxDailyRawJobs) break;
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
    DIRECT_BOARD_SOURCES.has(q.source),
  );
  const directBoards = plannedAtsBoards(options.params);
  const wantsAts = options.params.sourcesEnabled.includes("apify");
  const hasApify = Boolean(getApifyToken());
  const willRunAts = Boolean(wantsAts && hasApify && afford("ats"));
  const linkedInPlanned = linkedInQueries;
  const regionalPlanned = regionalQueries;
  const collectTotal =
    directBoards.length + freeQueries.length +
    (willRunAts ? 1 : 0) +
    linkedInPlanned.length +
    regionalPlanned.length;
  let collectDone = 0;

  const markCollect = async (detail: string, activity: SearchActivity) => {
    collectDone += 1;
    queryCount += 1;
    await report?.(
      progressFor(
        "collect",
        collectPercent(collectDone, Math.max(collectTotal, 1)),
        detail,
        { found: raw.length, sourcesDone: collectDone, sourcesTotal: collectTotal },
        activity,
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

  // Direct public boards run first; no token or paid fallback is required.
  // They may not use the whole raw budget when other sources are planned:
  // big careers boards would otherwise crowd out LinkedIn and regional boards.
  const otherSourcesPlanned =
    freeQueries.length + linkedInPlanned.length + regionalPlanned.length + (willRunAts ? 1 : 0) > 0;
  const directBudget = otherSourcesPlanned
    ? Math.ceil(options.params.maxDailyRawJobs * DIRECT_BOARD_SHARE)
    : options.params.maxDailyRawJobs;
  for (const entry of directBoards) {
    if (!roomForJobs() || raw.length >= directBudget) break;
    const db = getDb();
    const runId = newId("crun");
    await db.insert(collectorRuns).values({
      userId: await currentUserId(),
      id: runId, searchProfileVersion: options.searchProfileVersion,
      source: entry.board?.source ?? "direct_ats",
      queryJson: JSON.stringify({ board: entry.url, mode: "direct" }),
      startedAt: nowIso(), status: "running",
    });
    try {
      if (!entry.board) throw new Error(entry.error);
      const found = await collectDirectBoard(entry.board, options.params,
        Math.min(options.params.maxResultsPerQuery, directBudget - raw.length));
      pushJobs(found);
      await db.update(collectorRuns).set({ status: "ok", finishedAt: nowIso(), resultCount: found.length, costUsd: 0 })
        .where(and(await owned(collectorRuns), eq(collectorRuns.id, runId)));
      await markCollect(
        `${boardName(entry.board.slug)} careers · ${found.length} found`,
        foundActivity(boardName(entry.board.slug), `${SOURCE_LABELS[entry.board.source]} careers page`, found.length),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.update(collectorRuns).set({ status: "error", finishedAt: nowIso(), error: message.slice(0, 500), costUsd: 0 })
        .where(and(await owned(collectorRuns), eq(collectorRuns.id, runId)));
      await markCollect(
        `${entry.board ? boardName(entry.board.slug) : "Careers page"} · unavailable`,
        foundActivity(
          entry.board ? boardName(entry.board.slug) : entry.url,
          entry.board ? `${SOURCE_LABELS[entry.board.source]} careers page` : "Careers page",
          null,
        ),
      );
    }
  }

  // 1) Free APIs and feeds, each source within its own share of the budget.
  const freeSources = new Set(freeQueries.map((q) => q.source));
  const perFreeSource = Math.max(
    1,
    Math.ceil((options.params.maxDailyRawJobs * FREE_BOARD_SHARE) / Math.max(freeSources.size, 1)),
  );
  const freeTaken = new Map<string, number>();
  for (const query of freeQueries) {
    if (!roomForJobs()) break;
    if ((freeTaken.get(query.source) ?? 0) >= perFreeSource) {
      await markCollect(`${queryDetail(query)} · skipped (source budget reached)`, queryActivity(query, 0));
      continue;
    }
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
    const room = perFreeSource - (freeTaken.get(query.source) ?? 0);
    const kept = result.jobs.slice(0, room);
    freeTaken.set(query.source, (freeTaken.get(query.source) ?? 0) + kept.length);
    pushJobs(kept);
    await markCollect(
      `${queryDetail(query)} · ${kept.length} found`,
      queryActivity(query, kept.length),
    );
  }

  // 2) Apify ATS — single run on primary title (quality/$ winner)
  if (willRunAts && roomForJobs()) {
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
      await db.insert(collectorRuns)
        .values({
      userId: await currentUserId(),
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
        });

      try {
        const result = await collectAtsBoardsViaApify({
          params: options.params,
          titleFilter: title,
          maxItems,
        });
        apifyCostUsd += result.costUsd;
        pushJobs(result.jobs);

        await db.update(collectorRuns)
          .set({
            finishedAt: nowIso(),
            resultCount: result.jobs.length,
            costUsd: result.costUsd,
            status: "ok",
          })
          .where(and(await owned(collectorRuns), eq(collectorRuns.id, runId)));
        await markCollect(
          `${atsDetail} · ${result.jobs.length} found`,
          foundActivity("ATS boards", `${title} · ${boardCount} pages`, result.jobs.length),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.update(collectorRuns)
          .set({
            finishedAt: nowIso(),
            status: "error",
            error: message.slice(0, 500),
          })
          .where(and(await owned(collectorRuns), eq(collectorRuns.id, runId)));
        logger.warn({ err, title }, "Apify ATS collect failed");
        await markCollect(
          `${atsDetail} · unavailable`,
          foundActivity("ATS boards", `${title} · ${boardCount} pages`, null),
        );
      }
    }
  } else if (wantsAts && !getApifyToken()) {
    logger.info(
      "Optional Apify source enabled but APIFY_TOKEN missing — direct public sources remain available",
    );
  }

  // 3) LinkedIn — focused coverage queries
  for (const query of linkedInPlanned) {
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
      { apifyFallbackAllowed: afford("linkedin") },
    );
    apifyCostUsd += result.costUsd;
    pushJobs(result.jobs);
    await markCollect(
      `${queryDetail(query)} · ${result.jobs.length} found`,
      queryActivity(query, result.jobs.length),
    );
  }

  // 4) Regional boards (HelloWorld daily; Infostud if enabled)
  for (const query of regionalPlanned) {
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
    apifyCostUsd += result.costUsd;
    pushJobs(result.jobs);
    await markCollect(
      `${queryDetail(query)} · ${result.jobs.length} found`,
      queryActivity(query, result.jobs.length),
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
