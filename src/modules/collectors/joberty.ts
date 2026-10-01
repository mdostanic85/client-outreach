import { z } from "zod";
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
import { extractDomain } from "@/modules/companies/identity";
import { RawCollectedJobSchema, type CollectorQuery, type RawCollectedJob } from "./types";

/**
 * Joberty public jobs API (the listing behind joberty.com). robots.txt on
 * www.joberty.com allows it. Tech roles in Serbia only.
 */
const SOURCE_NAME = "joberty";
const API = "https://backend.joberty.com/api/v1/jobs";
const MAX_PAGES = 5;
const MAX_LISTING_REQUESTS = 12;

const text = z.string().nullish();
const ListItemSchema = z.object({
  id: z.union([z.number(), z.string()]),
  jobTitle: z.string().min(1),
  companyName: z.string().min(1),
  companyUrlName: text,
  cities: z.array(z.string()).nullish(),
  website: text,
});
const ListSchema = z.object({
  totalPage: z.number().nullish(),
  items: z.array(z.unknown()).default([]),
});
const DetailSchema = ListItemSchema.extend({
  text: text,
  applyUrl: text,
});

export type JobertyCard = {
  id: string;
  title: string;
  companyName: string;
  companyUrlName?: string;
  location?: string;
  companyDomain?: string;
  sourceUrl: string;
};

export function jobertySearchUrl(term: string, page: number): string {
  const url = new URL(API);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", "20");
  url.searchParams.set("search", term);
  return url.href;
}

export function jobertyDetailUrl(id: string): string {
  if (!/^\d+$/.test(id)) throw new Error("joberty id must be numeric");
  return `${API}/${id}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Prefer the employer's own apply link; otherwise the public Joberty route. */
export function jobertyPublicUrl(card: {
  id: string;
  title: string;
  companyUrlName?: string | null;
  applyUrl?: string | null;
}): string {
  if (card.applyUrl) {
    try {
      const url = new URL(card.applyUrl);
      if (url.protocol === "https:" && !url.username && !url.password) return url.href;
    } catch {
      // fall through to the Joberty route
    }
  }
  const company = card.companyUrlName && /^[a-z0-9-]+$/i.test(card.companyUrlName)
    ? card.companyUrlName
    : "company";
  const title = slug(card.title) || "job";
  return `https://www.joberty.com/${company}/${title}/${card.id}`;
}

function dropLogo(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const copy = { ...(value as Record<string, unknown>) };
  delete copy.logo;
  return copy;
}

export function parseJobertyList(payload: unknown): { cards: JobertyCard[]; last: boolean } {
  const list = ListSchema.parse(payload);
  const cards: JobertyCard[] = [];
  for (const row of list.items) {
    const parsed = ListItemSchema.safeParse(dropLogo(row));
    if (!parsed.success) continue;
    const item = parsed.data;
    const id = String(item.id);
    if (!/^\d+$/.test(id)) continue;
    cards.push({
      id,
      title: item.jobTitle.trim(),
      companyName: item.companyName.trim(),
      companyUrlName: item.companyUrlName ?? undefined,
      location: item.cities?.[0],
      companyDomain: extractDomain(item.website),
      sourceUrl: jobertyPublicUrl({ id, title: item.jobTitle, companyUrlName: item.companyUrlName }),
    });
  }
  return { cards, last: cards.length === 0 };
}

export function parseJobertyDetail(payload: unknown, card: JobertyCard): RawCollectedJob {
  const detail = DetailSchema.parse(dropLogo(payload));
  return RawCollectedJobSchema.parse({
    source: "joberty",
    externalId: card.id,
    title: detail.jobTitle.trim() || card.title,
    companyName: detail.companyName.trim() || card.companyName,
    companyDomain: extractDomain(detail.website) ?? card.companyDomain,
    location: detail.cities?.[0] ?? card.location,
    description: htmlToText(detail.text),
    sourceUrl: jobertyPublicUrl({
      id: card.id,
      title: detail.jobTitle || card.title,
      companyUrlName: detail.companyUrlName ?? card.companyUrlName,
      applyUrl: detail.applyUrl,
    }),
  });
}

function cardToJob(card: JobertyCard): RawCollectedJob {
  return RawCollectedJobSchema.parse({
    source: "joberty",
    externalId: card.id,
    title: card.title,
    companyName: card.companyName,
    companyDomain: card.companyDomain,
    location: card.location,
    description: "",
    sourceUrl: card.sourceUrl,
  });
}

export async function collectJoberty(
  query: CollectorQuery,
  params: JobSearchParams,
  deps: CollectorDeps = {},
): Promise<RawCollectedJob[]> {
  const sleep = deps.sleep ?? defaultSleep;
  const load = async (url: string) => {
    const body = await fetchPage(url, {
      source: SOURCE_NAME,
      userAgent: OPTRA_USER_AGENT,
      fetcher: deps.fetcher,
      accept: "application/json",
    });
    if (body.trimStart().startsWith("<")) throw new Error("joberty returned a page instead of JSON");
    return JSON.parse(body) as unknown;
  };
  const { cards, blocked } = await walkListing({
    terms: query.searchTerms?.length ? query.searchTerms : [query.title],
    maxPages: MAX_PAGES,
    maxRequests: MAX_LISTING_REQUESTS,
    delayMs: [800, 1600],
    sleep,
    loadPage: async (term, page) => parseJobertyList(await load(jobertySearchUrl(term, page))),
  });
  if (blocked) throw new SourceBlockedError(SOURCE_NAME, 429);
  const byId = cards;
  const shortlist = filterRawJobs([...byId.values()].map(cardToJob), params).kept.slice(0, query.maxResults);
  const { results } = await loadDetails(shortlist, {
    delayMs: [800, 1600],
    sleep,
    load: async (shell) => parseJobertyDetail(await load(jobertyDetailUrl(shell.externalId)), byId.get(shell.externalId)!),
  });
  return results;
}
