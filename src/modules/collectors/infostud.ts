import * as cheerio from "cheerio";
import { z } from "zod";
import type { JobSearchParams } from "@/modules/search-profile/schemas";
import { filterRawJobs } from "@/modules/jobs/filters";
import {
  defaultSleep,
  fetchPage,
  htmlToText,
  isoDate,
  loadDetails,
  OPTRA_USER_AGENT,
  SourceBlockedError,
  walkListing,
  type CollectorDeps,
} from "./polite-fetch";
import { RawCollectedJobSchema, type CollectorQuery, type RawCollectedJob } from "./types";

/**
 * Poslovi Infostud: search and posting pages embed Next.js JSON (`__NEXT_DATA__`),
 * so we read structured fields instead of scraping markup. robots.txt allows
 * /oglasi-za-posao and /posao; /rss_feed and /search are disallowed and unused.
 */
const SOURCE_NAME = "infostud";
const ORIGIN = "https://poslovi.infostud.com";
const PAGE_SIZE = 30;
const MAX_PAGES = 5;
const MAX_LISTING_REQUESTS = 12;

const text = z.string().nullish();
const SearchJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string().min(1),
  companyName: z.string().min(1),
  location: text,
  url: text,
  workFromHome: z.boolean().nullish(),
  hybridWork: z.boolean().nullish(),
  onlineViewDate: text,
});
const SearchSchema = z.object({
  totalPrimaryItems: z.number().nullish(),
  jobs: z.object({ primary: z.array(z.unknown()).default([]), secondary: z.array(z.unknown()).nullish() }),
});
const SalarySchema = z.object({
  from: z.number().nullish(), to: z.number().nullish(),
  currency: text, type: text, additional: text,
}).nullish();
const PostingSchema = z.object({
  textAd: text,
  datePosted: text,
  employmentType: z.object({ nameSr: text }).nullish(),
  salary: z.unknown().optional(),
  unformattedSalary: SalarySchema,
});

export type InfostudCard = {
  id: string;
  title: string;
  companyName: string;
  location?: string;
  remotePolicy: string;
  sourceUrl: string;
  postedAt?: string;
};

export function infostudSearchUrl(title: string, page: number): string {
  const url = new URL("/oglasi-za-posao", ORIGIN);
  url.searchParams.set("q", title);
  if (page > 1) url.searchParams.set("page", String(page));
  return url.href;
}

export function nextData(html: string): unknown {
  const raw = cheerio.load(html)("script#__NEXT_DATA__").text();
  if (!raw) throw new Error("infostud page has no __NEXT_DATA__");
  return JSON.parse(raw) as unknown;
}

function pageProps(html: string): Record<string, unknown> {
  const data = nextData(html) as { props?: { pageProps?: Record<string, unknown> } };
  return data.props?.pageProps ?? {};
}

function postingUrl(value: string | null | undefined, id: string): string | null {
  if (!value) return null;
  const url = new URL(value, ORIGIN);
  return url.origin === ORIGIN && new RegExp(`^/posao/[^/]+/[^/]+/${id}$`).test(url.pathname)
    ? `${ORIGIN}${url.pathname}`
    : null;
}

export function parseInfostudSearch(html: string): { cards: InfostudCard[]; total?: number } {
  const search = SearchSchema.parse(pageProps(html).initialSearchResults);
  const cards: InfostudCard[] = [];
  for (const row of [...search.jobs.primary, ...(search.jobs.secondary ?? [])]) {
    const parsed = SearchJobSchema.safeParse(row);
    if (!parsed.success) continue;
    const j = parsed.data;
    const id = String(j.id);
    const sourceUrl = /^\d+$/.test(id) ? postingUrl(j.url, id) : null;
    if (!sourceUrl) continue;
    // Infostud exposes workplace mode as explicit booleans, so onsite is a fact here, not a guess.
    const remotePolicy = j.workFromHome ? "remote" : j.hybridWork ? "hybrid" : "onsite";
    cards.push({
      id, title: j.title.trim(), companyName: j.companyName.trim(),
      location: j.location?.replace(/\s*\|\s*hibrid$/i, "").trim() || undefined,
      remotePolicy, sourceUrl,
      postedAt: isoDate(j.onlineViewDate),
    });
  }
  return { cards, total: search.totalPrimaryItems ?? undefined };
}

function salaryText(p: z.infer<typeof PostingSchema>): string | undefined {
  if (typeof p.salary === "string" && p.salary.trim()) return p.salary.trim();
  const s = p.unformattedSalary;
  if (!s || (s.from == null && s.to == null)) return undefined;
  const range = [s.from, s.to].filter(v => v != null).join("–");
  return [range, s.currency, s.type, s.additional].filter(Boolean).join(" ");
}

export function parseInfostudPosting(html: string): { description: string; postedAt?: string; employmentType?: string; salaryText?: string } {
  const posting = PostingSchema.parse(pageProps(html).job);
  return {
    description: htmlToText(posting.textAd),
    postedAt: isoDate(posting.datePosted),
    employmentType: posting.employmentType?.nameSr || undefined,
    salaryText: salaryText(posting),
  };
}

function cardToJob(card: InfostudCard, detail?: ReturnType<typeof parseInfostudPosting>): RawCollectedJob {
  return RawCollectedJobSchema.parse({
    source: "infostud",
    externalId: card.id,
    title: card.title,
    companyName: card.companyName,
    location: card.location,
    remotePolicy: card.remotePolicy,
    employmentType: detail?.employmentType,
    description: detail?.description ?? "",
    sourceUrl: card.sourceUrl,
    postedAt: detail?.postedAt ?? card.postedAt,
    salaryText: detail?.salaryText,
  });
}

export async function collectInfostud(
  query: CollectorQuery,
  params: JobSearchParams,
  deps: CollectorDeps = {},
): Promise<RawCollectedJob[]> {
  const sleep = deps.sleep ?? defaultSleep;
  const load = (url: string) => fetchPage(url, { source: "infostud", userAgent: OPTRA_USER_AGENT, fetcher: deps.fetcher });
  const { cards, blocked } = await walkListing({
    terms: query.searchTerms?.length ? query.searchTerms : [query.title],
    maxPages: MAX_PAGES, maxRequests: MAX_LISTING_REQUESTS, delayMs: [800, 1600], sleep,
    loadPage: async (term, page) => {
      const { cards: found, total } = parseInfostudSearch(await load(infostudSearchUrl(term, page + 1)));
      return { cards: found, last: found.length === 0 || (total != null && page * PAGE_SIZE + found.length >= total) };
    },
  });
  if (blocked) throw new SourceBlockedError(SOURCE_NAME, 429);
  const shortlist = filterRawJobs([...cards.values()].map(card => cardToJob(card)), params).kept.slice(0, query.maxResults);
  const { results } = await loadDetails(shortlist, {
    delayMs: [800, 1600], sleep,
    load: async shell => cardToJob(cards.get(shell.externalId)!, parseInfostudPosting(await load(shell.sourceUrl))),
  });
  return results;
}
