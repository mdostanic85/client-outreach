import * as cheerio from "cheerio";
import type { JobSearchParams } from "@/modules/search-profile/schemas";
import { filterRawJobs } from "@/modules/jobs/filters";
import {
  BROWSER_USER_AGENT,
  defaultSleep,
  fetchPage,
  htmlToText,
  isoDate,
  loadDetails,
  walkListing,
  type CollectorDeps,
} from "./polite-fetch";
import { RawCollectedJobSchema, type CollectorQuery, type RawCollectedJob } from "./types";

/**
 * LinkedIn public guest endpoints (no login, same ones JobSpy uses).
 * Low volume by design: jittered pauses, a hard page cap, and the whole source
 * stops on the first 429 / auth wall so the caller can fall back or retry tomorrow.
 */
const SEARCH_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const POSTING_URL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/";
const PAGE_SIZE = 10;
const MAX_SEARCH_PAGES = 4;

export type LinkedInCard = {
  id: string;
  title: string;
  companyName: string;
  location?: string;
  postedAt?: string;
};

export function linkedInSearchUrl(query: CollectorQuery, remote: boolean, start: number): string {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("keywords", query.title);
  url.searchParams.set("location", query.location);
  url.searchParams.set("f_TPR", `r${Math.max(1, query.postedWithinHours) * 3600}`);
  if (remote) url.searchParams.set("f_WT", "2");
  url.searchParams.set("start", String(start));
  return url.href;
}

export function parseLinkedInSearch(html: string): LinkedInCard[] {
  const $ = cheerio.load(html);
  const cards: LinkedInCard[] = [];
  $("[data-entity-urn^='urn:li:jobPosting:']").each((_, el) => {
    const card = $(el);
    const id = /^urn:li:jobPosting:(\d+)$/.exec(card.attr("data-entity-urn") ?? "")?.[1];
    const title = card.find(".base-search-card__title").text().replace(/\s+/g, " ").trim();
    const companyName = card.find(".base-search-card__subtitle").text().replace(/\s+/g, " ").trim();
    if (!id || !title || !companyName) return;
    cards.push({
      id, title, companyName,
      location: card.find(".job-search-card__location").text().trim() || undefined,
      postedAt: isoDate(card.find("time[datetime]").attr("datetime")),
    });
  });
  return cards;
}

export function parseLinkedInPosting(html: string): { description: string; employmentType?: string; seniority?: string } {
  const $ = cheerio.load(html);
  const criteria = new Map<string, string>();
  $(".description__job-criteria-item").each((_, el) => {
    const key = $(el).find(".description__job-criteria-subheader").text().trim().toLowerCase();
    const value = $(el).find(".description__job-criteria-text").text().trim();
    if (key && value) criteria.set(key, value);
  });
  return {
    description: htmlToText($(".show-more-less-html__markup").first().html()),
    employmentType: criteria.get("employment type"),
    seniority: criteria.get("seniority level"),
  };
}

function cardToJob(card: LinkedInCard, remote: boolean, detail?: ReturnType<typeof parseLinkedInPosting>): RawCollectedJob {
  return RawCollectedJobSchema.parse({
    source: "linkedin",
    // Same numeric ID the Apify actor stored, so existing jobs are updated in place.
    externalId: card.id,
    title: card.title,
    companyName: card.companyName,
    location: card.location,
    // Only claim remote when LinkedIn's own workplace filter was applied.
    remotePolicy: remote ? "remote" : undefined,
    employmentType: detail?.employmentType,
    description: detail?.description ?? "",
    sourceUrl: `https://www.linkedin.com/jobs/view/${card.id}`,
    postedAt: card.postedAt,
  });
}

export type LinkedInCollectResult = { jobs: RawCollectedJob[]; blocked: boolean; cardsSeen: number };

export async function collectLinkedIn(
  query: CollectorQuery,
  params: JobSearchParams,
  deps: CollectorDeps = {},
): Promise<LinkedInCollectResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const remote = params.remoteRequired || params.remotePolicy === "remote_ok_required";
  const load = (url: string) => fetchPage(url, { source: "linkedin", userAgent: BROWSER_USER_AGENT, fetcher: deps.fetcher });
  const listing = await walkListing({
    terms: [query.title],
    maxPages: Math.min(MAX_SEARCH_PAGES, Math.ceil((query.maxResults * 2) / PAGE_SIZE)),
    maxRequests: MAX_SEARCH_PAGES, delayMs: [2000, 4000], sleep,
    loadPage: async (_term, page) => {
      const found = parseLinkedInSearch(await load(linkedInSearchUrl(query, remote, page * PAGE_SIZE)));
      return { cards: found, last: found.length < PAGE_SIZE };
    },
  });
  const cards = listing.cards;
  if (listing.blocked) return { jobs: [], blocked: true, cardsSeen: cards.size };

  // Hard filters on the card first: never spend a detail request on an excluded title.
  const shortlist = filterRawJobs([...cards.values()].map(card => cardToJob(card, remote)), params)
    .kept.slice(0, query.maxResults);
  const details = await loadDetails(shortlist, {
    delayMs: [1000, 2500], sleep,
    load: async shell => {
      const job = cardToJob(cards.get(shell.externalId)!, remote, parseLinkedInPosting(await load(`${POSTING_URL}${shell.externalId}`)));
      // Without a description the match would be guesswork; skip rather than store a stub.
      return job.description ? job : null;
    },
  });
  return { jobs: details.results, blocked: details.blocked, cardsSeen: cards.size };
}
