import * as cheerio from "cheerio";
import type { JobSearchParams } from "@/modules/search-profile/schemas";
import { filterRawJobs } from "@/modules/jobs/filters";
import {
  defaultSleep,
  fetchPage,
  htmlToText,
  loadDetails,
  OPTRA_USER_AGENT,
  SourceBlockedError,
  walkListing,
  type CollectorDeps,
} from "./polite-fetch";
import { RawCollectedJobSchema, type CollectorQuery, type RawCollectedJob } from "./types";

/**
 * Nacionalna služba za zapošljavanje. robots.txt allows the public job
 * search and preview pages. No account, no application on the user's behalf.
 */
const SOURCE_NAME = "nsz";
const ORIGIN = "https://www.nsz.gov.rs";
const MAX_PAGES = 5;
const MAX_LISTING_REQUESTS = 12;

export type NszCard = {
  id: string;
  title: string;
  companyName: string;
  location?: string;
  sourceUrl: string;
};

export function nszSearchUrl(term: string, page: number): string {
  const url = new URL("/employee/jobs/search", ORIGIN);
  url.searchParams.set("keyword", term);
  if (page > 0) url.searchParams.set("page", String(page + 1));
  return url.href;
}

function splitEmployer(text: string): { companyName: string; location?: string } {
  const clean = text.replace(/\s+/g, " ").trim();
  const city = /\b(Beograd|Novi Sad|Niš|Nis|Kragujevac|Subotica|Čačak|Cacak|Pančevo|Pancevo|Zrenjanin|Šabac|Sabac|Kraljevo|Leskovac|Valjevo|Užice|Uzice|Vranje|Sombor|Smederevo)\b/i.exec(clean);
  if (!city || city.index == null) return { companyName: clean || "NSZ" };
  const companyName = clean.slice(0, city.index).replace(/[\s,–-]+$/g, "").trim();
  return { companyName: companyName || clean, location: city[1] };
}

export function parseNszListing(html: string): NszCard[] {
  const $ = cheerio.load(html);
  const cards = new Map<string, NszCard>();
  $(".single-job").each((_, el) => {
    const card = $(el);
    const onclick = card.find("[onclick]").attr("onclick") ?? "";
    const href = /employee\/jobs\/preview\/(\d+)/.exec(onclick)?.[1];
    const title = card.find("h3.job-title").text().replace(/\s+/g, " ").trim();
    if (!href || !title || cards.has(href)) return;
    const employer = splitEmployer(card.find("p.job-description").text());
    cards.set(href, {
      id: href,
      title,
      companyName: employer.companyName,
      location: employer.location,
      sourceUrl: `${ORIGIN}/employee/jobs/preview/${href}`,
    });
  });
  return [...cards.values()];
}

export function parseNszPosting(html: string): { description: string; location?: string } {
  const $ = cheerio.load(html);
  const description = htmlToText(
    [$(".job-content").html(), $(".job-requirements").html()].filter(Boolean).join(" "),
  );
  const location = $(".job-location").text().replace(/\s+/g, " ").trim() || undefined;
  return { description, location };
}

function cardToJob(card: NszCard, detail?: { description: string; location?: string }): RawCollectedJob {
  return RawCollectedJobSchema.parse({
    source: "nsz",
    externalId: card.id,
    title: card.title,
    companyName: card.companyName,
    location: detail?.location || card.location,
    description: detail?.description ?? "",
    sourceUrl: card.sourceUrl,
  });
}

export async function collectNsz(
  query: CollectorQuery,
  params: JobSearchParams,
  deps: CollectorDeps = {},
): Promise<RawCollectedJob[]> {
  const sleep = deps.sleep ?? defaultSleep;
  const load = (url: string) => fetchPage(url, {
    source: SOURCE_NAME,
    userAgent: OPTRA_USER_AGENT,
    fetcher: deps.fetcher,
  });
  const { cards, blocked } = await walkListing({
    terms: query.searchTerms?.length ? query.searchTerms : [query.title],
    maxPages: MAX_PAGES,
    maxRequests: MAX_LISTING_REQUESTS,
    delayMs: [800, 1600],
    sleep,
    loadPage: async (term, page) => {
      const found = parseNszListing(await load(nszSearchUrl(term, page)));
      return { cards: found, last: found.length === 0 };
    },
  });
  if (blocked) throw new SourceBlockedError(SOURCE_NAME, 429);
  const shortlist = filterRawJobs([...cards.values()].map((card) => cardToJob(card)), params).kept.slice(0, query.maxResults);
  const { results } = await loadDetails(shortlist, {
    delayMs: [800, 1600],
    sleep,
    load: async (shell) => cardToJob(cards.get(shell.externalId)!, parseNszPosting(await load(shell.sourceUrl))),
  });
  return results;
}
