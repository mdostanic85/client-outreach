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
 * Poslovi.rs public search. robots.txt allows /jobs and /job.
 * The listing is the same POST the site's search form sends to /jobs/jobs_ajax.
 */
const SOURCE_NAME = "poslovi";
const ORIGIN = "https://www.poslovi.rs";
const MAX_PAGES = 5;
const MAX_LISTING_REQUESTS = 12;

export type PosloviCard = {
  id: string;
  title: string;
  companyName: string;
  location?: string;
  sourceUrl: string;
};

export function posloviSearchUrl(page: number): string {
  return `${ORIGIN}/jobs/jobs_ajax/${page}`;
}

export function posloviForm(term: string, cityId?: string): URLSearchParams {
  const body = new URLSearchParams();
  body.set("is_list", "1");
  body.set("search_keywords", term);
  if (cityId && /^\d+$/.test(cityId)) body.append("search_cities[]", cityId);
  return body;
}

function postingUrl(href: string | undefined): { id: string; sourceUrl: string } | null {
  if (!href) return null;
  const url = new URL(href, ORIGIN);
  const match = /^\/job\/[^/]+\/[^/]+-(\d+)$/.exec(url.pathname);
  if (url.origin !== ORIGIN || !match) return null;
  return { id: match[1]!, sourceUrl: `${ORIGIN}${url.pathname}` };
}

export function parsePosloviListing(html: string): PosloviCard[] {
  const $ = cheerio.load(html);
  const cards = new Map<string, PosloviCard>();
  $("a.item-block").each((_, el) => {
    const link = $(el);
    const posting = postingUrl(link.attr("href"));
    const title = link.find("h4").first().text().replace(/\s+/g, " ").trim();
    const companyName = link.find("h5.epl_name_list").first().clone().children().remove().end().text().replace(/\s+/g, " ").trim()
      || link.find("h5").first().text().replace(/\s+/g, " ").trim();
    const location = link.find("span.status").attr("title")?.replace(/\s+/g, " ").trim()
      || link.find("span.status").text().replace(/\s+/g, " ").trim()
      || undefined;
    if (!posting || !title || !companyName || cards.has(posting.id)) return;
    cards.set(posting.id, { id: posting.id, title, companyName, location, sourceUrl: posting.sourceUrl });
  });
  return [...cards.values()];
}

export function parsePosloviPosting(html: string): { description: string } {
  const $ = cheerio.load(html);
  const description = htmlToText($(".text-justify").html() || $("h1").parent().html());
  return { description };
}

function cardToJob(card: PosloviCard, description = ""): RawCollectedJob {
  return RawCollectedJobSchema.parse({
    source: "poslovi",
    externalId: card.id,
    title: card.title,
    companyName: card.companyName,
    location: card.location,
    description,
    sourceUrl: card.sourceUrl,
  });
}

export async function collectPoslovi(
  query: CollectorQuery,
  params: JobSearchParams,
  deps: CollectorDeps = {},
): Promise<RawCollectedJob[]> {
  const sleep = deps.sleep ?? defaultSleep;
  const load = (url: string, body?: URLSearchParams) => fetchPage(url, {
    source: SOURCE_NAME,
    userAgent: OPTRA_USER_AGENT,
    fetcher: deps.fetcher,
    method: body ? "POST" : "GET",
    body,
  });
  const { cards, blocked } = await walkListing({
    terms: query.searchTerms?.length ? query.searchTerms : [query.title],
    maxPages: MAX_PAGES,
    maxRequests: MAX_LISTING_REQUESTS,
    delayMs: [800, 1600],
    sleep,
    loadPage: async (term, page) => {
      const found = parsePosloviListing(await load(posloviSearchUrl(page), posloviForm(term, query.cityId)));
      return { cards: found, last: found.length === 0 };
    },
  });
  if (blocked) throw new SourceBlockedError(SOURCE_NAME, 429);
  const shortlist = filterRawJobs([...cards.values()].map((card) => cardToJob(card)), params).kept.slice(0, query.maxResults);
  const { results } = await loadDetails(shortlist, {
    delayMs: [800, 1600],
    sleep,
    load: async (shell) => cardToJob(cards.get(shell.externalId)!, parsePosloviPosting(await load(shell.sourceUrl)).description),
  });
  return results;
}
