import * as cheerio from "cheerio";
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

/** HelloWorld.rs public listing + posting pages (robots.txt allows both). */
const SOURCE_NAME = "helloworld";
const ORIGIN = "https://www.helloworld.rs";
const PAGE_SIZE = 30;
const MAX_PAGES = 6;
const MAX_LISTING_REQUESTS = 12;

export type HelloWorldCard = {
  id: string;
  title: string;
  companyName: string;
  location?: string;
  remotePolicy?: string;
  sourceUrl: string;
};

export function helloWorldSearchUrl(title: string, page: number): string {
  // Pagination is offset based: /oglasi-za-posao/stranica/30, /60, …
  const url = new URL(page === 0 ? "/oglasi-za-posao" : `/oglasi-za-posao/stranica/${page * PAGE_SIZE}`, ORIGIN);
  url.searchParams.set("q", title);
  return url.href;
}

/** HelloWorld encodes workplace mode in the location label: "Beograd | Hibrid", "Rad od kuće". */
export function helloWorldWorkplace(label: string): { location?: string; remotePolicy?: string } {
  const text = label.replace(/\s+/g, " ").trim();
  if (!text) return {};
  if (/rad od ku[cć]e|remote/i.test(text)) return { location: text, remotePolicy: "remote" };
  const [place, mode] = text.split("|").map(s => s.trim());
  if (mode && /hibrid/i.test(mode)) return { location: place, remotePolicy: "hybrid" };
  return { location: place || text, remotePolicy: "onsite" };
}

function postingUrl(href: string | undefined): string | null {
  if (!href) return null;
  const url = new URL(href, ORIGIN);
  if (url.origin !== ORIGIN || !/^\/posao\/[^/]+\/[^/]+\/\d+$/.test(url.pathname)) return null;
  return `${ORIGIN}${url.pathname}`;
}

export function parseHelloWorldListing(html: string): HelloWorldCard[] {
  const $ = cheerio.load(html);
  const cards = new Map<string, HelloWorldCard>();
  $("h3 a[data-job-id]").each((_, el) => {
    const link = $(el);
    const id = link.attr("data-job-id") ?? "";
    const sourceUrl = postingUrl(link.attr("href"));
    const card = link.closest(".shadow-md");
    const title = link.text().replace(/\s+/g, " ").trim();
    const companyName = card.find("h4").first().text().replace(/\s+/g, " ").trim();
    if (!/^\d+$/.test(id) || !sourceUrl || !title || !companyName || cards.has(id)) return;
    const place = card.find(".la-map-marker").first().parent().find("p").first().text();
    cards.set(id, { id, title, companyName, sourceUrl, ...helloWorldWorkplace(place) });
  });
  return [...cards.values()];
}

type JsonLdPosting = {
  "@type"?: string;
  datePosted?: string;
  employmentType?: string;
  hiringOrganization?: { name?: string };
};

export function jobPostingJsonLd(html: string): JsonLdPosting | undefined {
  const $ = cheerio.load(html);
  for (const el of $("script[type='application/ld+json']").toArray()) {
    try {
      const data = JSON.parse($(el).text()) as JsonLdPosting | JsonLdPosting[];
      const found = (Array.isArray(data) ? data : [data]).find(d => d?.["@type"] === "JobPosting");
      if (found) return found;
    } catch { /* ignore unrelated or malformed blocks */ }
  }
  return undefined;
}

export function parseHelloWorldPosting(html: string): { description: string; postedAt?: string; employmentType?: string } {
  const $ = cheerio.load(html);
  const ld = jobPostingJsonLd(html);
  return {
    // JSON-LD description is a one-line stub; the real text lives in the job body.
    description: htmlToText($(".__job-text-body").first().html()),
    postedAt: isoDate(ld?.datePosted),
    employmentType: ld?.employmentType || undefined,
  };
}

function cardToJob(card: HelloWorldCard, detail?: ReturnType<typeof parseHelloWorldPosting>): RawCollectedJob {
  return RawCollectedJobSchema.parse({
    source: "helloworld",
    externalId: card.id,
    title: card.title,
    companyName: card.companyName,
    location: card.location,
    remotePolicy: card.remotePolicy,
    employmentType: detail?.employmentType,
    description: detail?.description ?? "",
    sourceUrl: card.sourceUrl,
    postedAt: detail?.postedAt,
  });
}

export async function collectHelloWorld(
  query: CollectorQuery,
  params: JobSearchParams,
  deps: CollectorDeps = {},
): Promise<RawCollectedJob[]> {
  const sleep = deps.sleep ?? defaultSleep;
  const load = (url: string) => fetchPage(url, { source: "helloworld", userAgent: OPTRA_USER_AGENT, fetcher: deps.fetcher });
  const { cards, blocked } = await walkListing({
    terms: query.searchTerms?.length ? query.searchTerms : [query.title],
    maxPages: MAX_PAGES, maxRequests: MAX_LISTING_REQUESTS, delayMs: [800, 1600], sleep,
    loadPage: async (term, page) => {
      const found = parseHelloWorldListing(await load(helloWorldSearchUrl(term, page)));
      return { cards: found, last: found.length < PAGE_SIZE };
    },
  });
  if (blocked) throw new SourceBlockedError(SOURCE_NAME, 429);
  // Hard filters on the card first: never spend a detail request on an excluded title.
  const shortlist = filterRawJobs([...cards.values()].map(card => cardToJob(card)), params).kept.slice(0, query.maxResults);
  const { results } = await loadDetails(shortlist, {
    delayMs: [800, 1600], sleep,
    load: async shell => cardToJob(cards.get(shell.externalId)!, parseHelloWorldPosting(await load(shell.sourceUrl))),
  });
  return results;
}
