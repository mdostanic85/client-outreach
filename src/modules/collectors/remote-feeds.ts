import * as cheerio from "cheerio";
import { companyDomainFromPosting } from "./posting-html";
import {
  fetchPage,
  htmlToText,
  isoDate,
  OPTRA_USER_AGENT,
  type CollectorDeps,
} from "./polite-fetch";
import { RawCollectedJobSchema, titleMatchesQuery, type CollectorQuery } from "./types";
import type { RawCollectedJob } from "./types";

/**
 * Free remote-job boards that publish their listings as a public JSON API or
 * an RSS feed: RemoteOK, Himalayas, Jobicy, We Work Remotely, Working Nomads.
 *
 * Each adapter reads the board's feed, keeps postings whose title matches the
 * search (the same rule as the other free boards) and maps them to
 * `RawCollectedJob`. Every row keeps its own link, so the list sends people
 * back to the board it came from, which these boards ask for in return.
 *
 * Payload shapes follow each board's public documentation. A feed that
 * changes shape fails that one source in `collector_runs` (the other sources
 * keep running); `scripts/jobs-sources-smoke.ts` checks them live.
 */

/** Hard ceiling per feed, whatever the search asks for. */
const FEED_MAX = 100;

/** Boards ask not to be polled often; one run per feed per half hour is plenty. */
const FEED_TTL_MS = 30 * 60 * 1000;
const feedCache = new Map<string, { at: number; body: string }>();

async function readFeed(
  url: string,
  source: string,
  accept: string,
  deps: CollectorDeps,
): Promise<string> {
  const cached = feedCache.get(url);
  if (cached && Date.now() - cached.at < FEED_TTL_MS && !deps.fetcher) return cached.body;
  const body = await fetchPage(url, { source, userAgent: OPTRA_USER_AGENT, accept, fetcher: deps.fetcher });
  if (!deps.fetcher) feedCache.set(url, { at: Date.now(), body });
  return body;
}

async function readJson(url: string, source: string, deps: CollectorDeps): Promise<unknown> {
  const body = await readFeed(url, source, "application/json", deps);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${source} did not return JSON`);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(str).filter((v): v is string => Boolean(v));
  const single = str(value);
  return single ? [single] : [];
}

/** Unix seconds, unix milliseconds or a date string → ISO. */
function toIso(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  const text = str(value);
  if (!text) return undefined;
  if (/^\d{9,13}$/.test(text)) return toIso(Number(text));
  // Jobicy sends "2026-09-28 10:00:00" (UTC).
  return isoDate(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text) ? `${text.replace(" ", "T")}Z` : text);
}

function salaryText(min: unknown, max: unknown, currency: unknown, period: string): string | undefined {
  const lo = typeof min === "number" && min > 0 ? min : undefined;
  const hi = typeof max === "number" && max > 0 ? max : undefined;
  if (!lo && !hi) return undefined;
  const range = lo && hi && lo !== hi ? `${lo.toLocaleString("en-US")}–${hi.toLocaleString("en-US")}` : (lo ?? hi)!.toLocaleString("en-US");
  return `${range} ${str(currency) ?? "USD"} / ${period}`;
}

/** Where a remote role can be done from, as the board states it. "Remote - US only". */
function remoteLocation(region: string | undefined): string {
  const place = region?.trim();
  if (!place) return "Remote";
  if (/^remote\b/i.test(place)) return place;
  return `Remote - ${place}`;
}

function finish(
  jobs: Array<RawCollectedJob | null>,
  query: CollectorQuery,
): RawCollectedJob[] {
  const seen = new Set<string>();
  const out: RawCollectedJob[] = [];
  for (const job of jobs) {
    if (!job || seen.has(job.externalId)) continue;
    if (!titleMatchesQuery(job.title, query)) continue;
    seen.add(job.externalId);
    out.push(job);
    if (out.length >= Math.min(FEED_MAX, Math.max(query.maxResults * 3, 30))) break;
  }
  return out;
}

function build(input: Record<string, unknown>): RawCollectedJob | null {
  const parsed = RawCollectedJobSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

// ─── RemoteOK ───────────────────────────────────────────────────────────────

const REMOTEOK_API = "https://remoteok.com/api";

/** `https://remoteok.com/api`: one array; the first element is a legal notice, not a job. */
export function parseRemoteOk(payload: unknown): RawCollectedJob[] {
  if (!Array.isArray(payload)) throw new Error("remoteok returned an unexpected payload");
  return payload.flatMap((row) => {
    const job = asRecord(row);
    const title = str(job?.position);
    const company = str(job?.company);
    if (!job || !title || !company) return [];
    const slug = str(job.slug);
    const url = str(job.url) ?? (slug ? `https://remoteok.com/remote-jobs/${slug}` : undefined);
    const id = str(job.id) ?? slug;
    if (!url || !id) return [];
    const tags = strings(job.tags);
    const body = htmlToText(str(job.description), 12_000);
    return [
      build({
        source: "remoteok",
        externalId: id,
        title,
        companyName: company,
        companyDomain: undefined,
        location: remoteLocation(str(job.location)),
        remotePolicy: "remote",
        description: tags.length ? `${body} Tags: ${tags.join(", ")}.` : body,
        sourceUrl: url,
        postedAt: toIso(job.date) ?? toIso(job.epoch),
        salaryText: salaryText(job.salary_min, job.salary_max, "USD", "year"),
      }),
    ];
  }).filter((job): job is RawCollectedJob => job !== null);
}

export async function collectRemoteOk(query: CollectorQuery, deps: CollectorDeps = {}): Promise<RawCollectedJob[]> {
  return finish(parseRemoteOk(await readJson(REMOTEOK_API, "remoteok", deps)), query);
}

// ─── Himalayas ──────────────────────────────────────────────────────────────

const HIMALAYAS_SEARCH = "https://himalayas.app/jobs/api/search";

export function himalayasSearchUrl(term: string, page: number): string {
  const url = new URL(HIMALAYAS_SEARCH);
  url.searchParams.set("q", term);
  url.searchParams.set("sort", "recent");
  url.searchParams.set("page", String(page));
  return url.href;
}

/**
 * Himalayas lists the countries a role is open to (`locationRestrictions`);
 * an empty list means worldwide. That is the one board that states it.
 */
export function parseHimalayas(payload: unknown): RawCollectedJob[] {
  const root = asRecord(payload);
  const list = root?.jobs;
  if (!Array.isArray(list)) throw new Error("himalayas returned an unexpected payload");
  return list.flatMap((row) => {
    const job = asRecord(row);
    const title = str(job?.title);
    const company = str(job?.companyName);
    const url = str(job?.applicationLink) ?? str(job?.guid);
    if (!job || !title || !company || !url) return [];
    const countries = strings(job.locationRestrictions);
    const description = htmlToText(str(job.description) ?? str(job.excerpt), 12_000);
    return [
      build({
        source: "himalayas",
        externalId: str(job.guid) ?? url,
        title,
        companyName: company,
        location: countries.length ? `Remote - ${countries.join(", ")}` : "Remote - Worldwide",
        remotePolicy: "remote",
        employmentType: str(job.employmentType),
        description,
        sourceUrl: url,
        postedAt: toIso(job.pubDate),
        salaryText: salaryText(job.minSalary, job.maxSalary, job.currency, "year"),
      }),
    ];
  }).filter((job): job is RawCollectedJob => job !== null);
}

export async function collectHimalayas(query: CollectorQuery, deps: CollectorDeps = {}): Promise<RawCollectedJob[]> {
  const terms = [query.title, ...(query.searchTerms ?? [])].slice(0, 3);
  const jobs: RawCollectedJob[] = [];
  for (const term of terms) {
    for (const page of [1, 2]) {
      const found = parseHimalayas(await readJson(himalayasSearchUrl(term, page), "himalayas", deps));
      jobs.push(...found);
      if (found.length < 20) break;
    }
  }
  return finish(jobs, query);
}

// ─── Jobicy ─────────────────────────────────────────────────────────────────

export function jobicyUrl(term: string): string {
  const url = new URL("https://jobicy.com/api/v2/remote-jobs");
  url.searchParams.set("count", "50");
  url.searchParams.set("tag", term);
  return url.href;
}

/** `jobGeo` says where the role is open: "Anywhere", "USA", "Europe", "Serbia". */
export function parseJobicy(payload: unknown): RawCollectedJob[] {
  const list = asRecord(payload)?.jobs;
  if (!Array.isArray(list)) throw new Error("jobicy returned an unexpected payload");
  return list.flatMap((row) => {
    const job = asRecord(row);
    const title = str(job?.jobTitle);
    const company = str(job?.companyName);
    const url = str(job?.url);
    if (!job || !title || !company || !url) return [];
    return [
      build({
        source: "jobicy",
        externalId: str(job.id) ?? url,
        title,
        companyName: company,
        location: remoteLocation(str(job.jobGeo)),
        remotePolicy: "remote",
        employmentType: strings(job.jobType)[0],
        description: htmlToText(str(job.jobDescription) ?? str(job.jobExcerpt), 12_000),
        sourceUrl: url,
        postedAt: toIso(job.pubDate),
        salaryText: salaryText(job.annualSalaryMin, job.annualSalaryMax, job.salaryCurrency, "year"),
      }),
    ];
  }).filter((job): job is RawCollectedJob => job !== null);
}

export async function collectJobicy(query: CollectorQuery, deps: CollectorDeps = {}): Promise<RawCollectedJob[]> {
  const jobs: RawCollectedJob[] = [];
  for (const term of [query.title, ...(query.searchTerms ?? [])].slice(0, 2)) {
    jobs.push(...parseJobicy(await readJson(jobicyUrl(term), "jobicy", deps)));
  }
  return finish(jobs, query);
}

// ─── We Work Remotely (RSS) ─────────────────────────────────────────────────

const WWR_ORIGIN = "https://weworkremotely.com";

/** Category feeds worth reading for each occupation family, besides the all-jobs feed. */
const WWR_FEEDS: Record<string, string[]> = {
  tech_digital: [
    "remote-design-jobs",
    "remote-programming-jobs",
    "remote-product-jobs",
    "remote-devops-sysadmin-jobs",
    "remote-data-jobs",
  ],
  office_business: [
    "remote-sales-and-marketing-jobs",
    "remote-customer-support-jobs",
    "remote-management-and-finance-jobs",
    "remote-copywriting-jobs",
  ],
};

export function weWorkRemotelyFeeds(family: string | undefined): string[] {
  const categories = family ? (WWR_FEEDS[family] ?? []) : [];
  return [
    `${WWR_ORIGIN}/remote-jobs.rss`,
    ...categories.map((slug) => `${WWR_ORIGIN}/categories/${slug}.rss`),
  ];
}

/** Titles look like "Acme: Senior Product Designer"; `region` says who may apply. */
export function parseWeWorkRemotely(xml: string): RawCollectedJob[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out: Array<RawCollectedJob | null> = [];
  $("item").each((_, el) => {
    const item = $(el);
    const raw = item.children("title").text().trim();
    const link = item.children("link").text().trim() || item.children("guid").text().trim();
    if (!raw || !link) return;
    const split = raw.indexOf(": ");
    const company = split > 0 ? raw.slice(0, split).trim() : "";
    const title = split > 0 ? raw.slice(split + 2).trim() : raw;
    const body = item.children("description").text();
    out.push(
      build({
        source: "weworkremotely",
        externalId: item.children("guid").text().trim() || link,
        title,
        companyName: company || "Unknown company",
        companyDomain: companyDomainFromPosting(body, company, /weworkremotely\.com/i),
        location: remoteLocation(item.children("region").text().trim() || undefined),
        remotePolicy: "remote",
        employmentType: item.children("type").text().trim() || undefined,
        description: htmlToText(body, 12_000),
        sourceUrl: link,
        postedAt: toIso(item.children("pubDate").text().trim()),
      }),
    );
  });
  return out.filter((job): job is RawCollectedJob => job !== null);
}

export async function collectWeWorkRemotely(
  query: CollectorQuery,
  deps: CollectorDeps = {},
): Promise<RawCollectedJob[]> {
  const jobs: RawCollectedJob[] = [];
  let firstError: unknown = null;
  for (const url of weWorkRemotelyFeeds(query.family)) {
    try {
      jobs.push(...parseWeWorkRemotely(await readFeed(url, "weworkremotely", "application/rss+xml,application/xml", deps)));
    } catch (err) {
      // One missing category feed must not lose the others.
      firstError ??= err;
    }
  }
  if (jobs.length === 0 && firstError) throw firstError;
  return finish(jobs, query);
}

// ─── Working Nomads ─────────────────────────────────────────────────────────

const WORKING_NOMADS_API = "https://www.workingnomads.com/api/exposed_jobs/";

export function parseWorkingNomads(payload: unknown): RawCollectedJob[] {
  if (!Array.isArray(payload)) throw new Error("workingnomads returned an unexpected payload");
  return payload.flatMap((row) => {
    const job = asRecord(row);
    const title = str(job?.title);
    const company = str(job?.company_name);
    const url = str(job?.url);
    if (!job || !title || !company || !url || job.expired === true) return [];
    const tags = strings(typeof job.tags === "string" ? job.tags.split(",") : job.tags);
    const body = htmlToText(str(job.description), 12_000);
    return [
      build({
        source: "workingnomads",
        externalId: url,
        title,
        companyName: company,
        location: remoteLocation(str(job.location)),
        remotePolicy: "remote",
        description: tags.length ? `${body} Tags: ${tags.join(", ")}.` : body,
        sourceUrl: url,
        postedAt: toIso(job.pub_date),
      }),
    ];
  }).filter((job): job is RawCollectedJob => job !== null);
}

export async function collectWorkingNomads(query: CollectorQuery, deps: CollectorDeps = {}): Promise<RawCollectedJob[]> {
  return finish(parseWorkingNomads(await readJson(WORKING_NOMADS_API, "workingnomads", deps)), query);
}

