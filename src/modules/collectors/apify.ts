import { getSecret } from "@/lib/security/secrets";
import { logger } from "@/lib/logging/logger";
import type { JobSearchParams, JobSource } from "@/modules/search-profile/schemas";
import {
  RawCollectedJobSchema,
  type CollectorQuery,
  type RawCollectedJob,
} from "./types";

/** Default ATS actor — Greenhouse / Lever / Ashby / etc. public boards. */
export const DEFAULT_ATS_ACTOR = "fetch_cat/ats-jobs-scraper";

/**
 * Env-configurable Apify actor IDs per source.
 * Falls back to APIFY_ACTOR_GENERIC, then DEFAULT_ATS_ACTOR for ATS sources.
 */
export function apifyActorIdForSource(source: JobSource): string | null {
  const map: Partial<Record<JobSource, string | undefined>> = {
    greenhouse: process.env.APIFY_ACTOR_GREENHOUSE,
    lever: process.env.APIFY_ACTOR_LEVER,
    ashby: process.env.APIFY_ACTOR_ASHBY,
    infostud: process.env.APIFY_ACTOR_INFOSTUD,
    helloworld: process.env.APIFY_ACTOR_HELLOWORLD,
    linkedin: process.env.APIFY_ACTOR_LINKEDIN,
    apify: process.env.APIFY_ACTOR_GENERIC,
  };
  const explicit = map[source]?.trim();
  if (explicit) return explicit;

  const generic = process.env.APIFY_ACTOR_GENERIC?.trim();
  if (generic) return generic;

  // Built-in default for ATS sources so token-only setup works
  if (
    source === "greenhouse" ||
    source === "lever" ||
    source === "ashby" ||
    source === "apify"
  ) {
    return DEFAULT_ATS_ACTOR;
  }
  return null;
}

export function getApifyToken(): string | null {
  return getSecret("APIFY_TOKEN")?.trim() || null;
}

type ApifyRunResponse = {
  data?: {
    id?: string;
    status?: string;
    defaultDatasetId?: string;
    usageTotalUsd?: number;
  };
};

/**
 * Run an Apify actor and wait for dataset items.
 */
export async function runApifyActor(options: {
  actorId: string;
  input: Record<string, unknown>;
  waitSecs?: number;
}): Promise<{ items: unknown[]; costUsd: number; runId: string | null }> {
  const token = getApifyToken();
  if (!token) {
    throw new Error("APIFY_TOKEN not configured");
  }

  const wait = options.waitSecs ?? 180;
  const actorPath = options.actorId.replace(/\//g, "~");
  const startUrl = `https://api.apify.com/v2/acts/${actorPath}/runs?token=${encodeURIComponent(token)}&waitForFinish=${wait}`;

  const startRes = await fetch(startUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(options.input),
    cache: "no-store",
  });

  if (!startRes.ok) {
    const body = await startRes.text();
    throw new Error(
      `Apify run failed HTTP ${startRes.status}: ${body.slice(0, 300)}`,
    );
  }

  const runJson = (await startRes.json()) as ApifyRunResponse;
  const datasetId = runJson.data?.defaultDatasetId;
  const costUsd = Number(runJson.data?.usageTotalUsd ?? 0);
  const runId = runJson.data?.id ?? null;

  if (!datasetId) {
    logger.warn({ runJson }, "Apify run returned no dataset");
    return { items: [], costUsd, runId };
  }

  const itemsUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&clean=1`;
  const itemsRes = await fetch(itemsUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!itemsRes.ok) {
    throw new Error(`Apify dataset fetch failed HTTP ${itemsRes.status}`);
  }
  const items = (await itemsRes.json()) as unknown[];
  return { items: Array.isArray(items) ? items : [], costUsd, runId };
}

function asLocationString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value || undefined;
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === "string") return v;
        if (v && typeof v === "object" && "name" in v) {
          return String((v as { name: unknown }).name);
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object" && value && "name" in value) {
    return String((value as { name: unknown }).name);
  }
  return undefined;
}

function mapItemToJob(
  item: Record<string, unknown>,
  source: JobSource,
): RawCollectedJob | null {
  const title = String(
    item.title ?? item.positionName ?? item.jobTitle ?? item.name ?? "",
  ).trim();
  const companyName = String(
    item.companyName ??
      item.company ??
      item.employer ??
      item.companyIdentifier ??
      "Unknown",
  ).trim();
  const sourceUrl = String(
    item.url ??
      item.applyUrl ??
      item.absoluteUrl ??
      item.link ??
      item.jobUrl ??
      item.jobPageUrl ??
      "",
  ).trim();
  const externalId = String(
    item.id ??
      item.externalId ??
      item.guid ??
      item.jobId ??
      sourceUrl ??
      `${title}-${companyName}`,
  ).trim();

  if (!title || !sourceUrl) return null;

  const remoteSignal = String(
    item.workplaceType ?? item.remotePolicy ?? item.remote ?? "",
  ).toLowerCase();
  const isRemote =
    remoteSignal.includes("remote") ||
    item.remote === true ||
    /remote/i.test(asLocationString(item.location) ?? "");

  try {
    return RawCollectedJobSchema.parse({
      source,
      externalId,
      title,
      companyName: companyName || "Unknown",
      location: asLocationString(item.location ?? item.locations ?? item.jobLocation),
      remotePolicy: isRemote ? "remote" : remoteSignal || undefined,
      employmentType: String(
        item.employmentType ?? item.commitment ?? item.jobType ?? "",
      ) || undefined,
      description: String(
        item.description ??
          item.descriptionText ??
          item.descriptionHtml ??
          item.content ??
          "",
      ).slice(0, 12000),
      sourceUrl,
      postedAt:
        String(
          item.postedAt ??
            item.publishedAt ??
            item.datePosted ??
            item.updatedAt ??
            "",
        ) || undefined,
      salaryText: String(
        item.salary ?? item.salaryText ?? item.compensation ?? "",
      ) || undefined,
    });
  } catch {
    return null;
  }
}

function detectSourceFromUrl(url: string): JobSource {
  if (/greenhouse/i.test(url)) return "greenhouse";
  if (/lever\.co/i.test(url)) return "lever";
  if (/ashby/i.test(url)) return "ashby";
  return "apify";
}

/**
 * One focused ATS Apify run: company boards + title keyword filter.
 * This matches fetch_cat/ats-jobs-scraper input contract.
 */
export async function collectAtsBoardsViaApify(options: {
  params: JobSearchParams;
  titleFilter: string;
  maxItems: number;
}): Promise<{ jobs: RawCollectedJob[]; costUsd: number; actorId: string | null }> {
  if (!getApifyToken()) {
    logger.info("APIFY_TOKEN missing — skipping ATS Apify collect");
    return { jobs: [], costUsd: 0, actorId: null };
  }

  const boards = (options.params.atsBoardUrls ?? []).filter(Boolean).slice(0, 25);
  if (boards.length === 0) {
    logger.info("No atsBoardUrls configured — skipping ATS Apify collect");
    return { jobs: [], costUsd: 0, actorId: null };
  }

  const actorId =
    process.env.APIFY_ACTOR_GENERIC?.trim() ||
    apifyActorIdForSource("greenhouse") ||
    DEFAULT_ATS_ACTOR;

  const input = {
    startUrls: boards.map((url) => ({ url })),
    maxItems: options.maxItems,
    includeDescriptions: true,
    keywordFilter: options.titleFilter,
  };

  logger.info(
    { actorId, boards: boards.length, keywordFilter: options.titleFilter },
    "Starting Apify ATS collect",
  );

  const { items, costUsd } = await runApifyActor({
    actorId,
    input,
    waitSecs: 240,
  });

  const jobs: RawCollectedJob[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const url = String(row.url ?? row.applyUrl ?? row.jobPageUrl ?? "");
    const mapped = mapItemToJob(row, detectSourceFromUrl(url));
    if (mapped) jobs.push(mapped);
  }

  return { jobs, costUsd, actorId };
}

/** Legacy per-query path (LinkedIn / custom actors). */
export async function collectViaApify(
  query: CollectorQuery,
): Promise<{ jobs: RawCollectedJob[]; costUsd: number }> {
  const actorId = apifyActorIdForSource(query.source);
  if (!actorId) {
    logger.info(
      { source: query.source },
      "No Apify actor configured for source — skipping",
    );
    return { jobs: [], costUsd: 0 };
  }
  if (!getApifyToken()) {
    logger.info("APIFY_TOKEN missing — skipping Apify collectors");
    return { jobs: [], costUsd: 0 };
  }

  // ATS sources should use collectAtsBoardsViaApify (batch). Skip matrix spam.
  if (
    query.source === "greenhouse" ||
    query.source === "lever" ||
    query.source === "ashby"
  ) {
    return { jobs: [], costUsd: 0 };
  }

  const search = [query.title, ...(query.keywords ?? []).slice(0, 3)]
    .filter(Boolean)
    .join(" ");

  const { items, costUsd } = await runApifyActor({
    actorId,
    input: {
      search,
      query: search,
      title: query.title,
      location: query.location,
      maxItems: query.maxResults,
      maxResults: query.maxResults,
      postedWithinHours: query.postedWithinHours,
      keywords: query.keywords ?? [],
    },
  });

  const jobs: RawCollectedJob[] = [];
  for (const raw of items.slice(0, query.maxResults)) {
    if (!raw || typeof raw !== "object") continue;
    const mapped = mapItemToJob(raw as Record<string, unknown>, query.source);
    if (mapped) jobs.push(mapped);
  }

  return { jobs, costUsd };
}
