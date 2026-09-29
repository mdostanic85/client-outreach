import { z } from "zod";
import * as cheerio from "cheerio";
import type { JobSearchParams } from "@/modules/search-profile/schemas";
import { filterRawJobs } from "@/modules/jobs/filters";
import { RawCollectedJobSchema, type RawCollectedJob } from "./types";

export type AtsBoard = {
  source: "greenhouse" | "lever" | "ashby";
  slug: string;
  region: "us" | "eu";
  endpoint: string;
};

/** Only public board URLs; user input never becomes an arbitrary fetch target. */
export function parseAtsBoard(input: string): AtsBoard {
  const u = new URL(input);
  if (u.protocol !== "https:" || u.username || u.password || u.port) {
    throw new Error("Use a public HTTPS ATS board URL");
  }
  const parts = u.pathname.split("/").filter(Boolean);
  const slug = parts[0];
  if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug) || parts.length !== 1) {
    throw new Error("Use the company board URL, not an individual posting");
  }
  if (["boards.greenhouse.io", "job-boards.greenhouse.io", "boards.eu.greenhouse.io", "job-boards.eu.greenhouse.io"].includes(u.hostname)) {
    const region = u.hostname.includes(".eu.") ? "eu" : "us";
    return { source: "greenhouse", slug, region, endpoint: `https://boards-api${region === "eu" ? ".eu" : ""}.greenhouse.io/v1/boards/${slug}/jobs?content=true` };
  }
  if (["jobs.lever.co", "jobs.eu.lever.co"].includes(u.hostname)) {
    const region = u.hostname === "jobs.eu.lever.co" ? "eu" : "us";
    return { source: "lever", slug, region, endpoint: `https://api${region === "eu" ? ".eu" : ""}.lever.co/v0/postings/${slug}?mode=json` };
  }
  if (u.hostname === "jobs.ashbyhq.com") {
    return { source: "ashby", slug, region: "us", endpoint: `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true` };
  }
  throw new Error("Supported boards: Greenhouse, Lever and Ashby");
}

const optionalText = z.string().nullish();
const id = z.union([z.string().min(1), z.number().finite()]);
const greenhouse = z.object({
  id, title: z.string().min(1), absolute_url: z.string().url(),
  content: optionalText, company_name: optionalText,
  location: z.object({ name: optionalText }).nullish(),
  first_published: optionalText,
});
const lever = z.object({
  id, text: z.string().min(1), hostedUrl: z.string().url(),
  descriptionPlain: optionalText, description: optionalText,
  additionalPlain: optionalText, workplaceType: optionalText,
  categories: z.object({ location: optionalText, commitment: optionalText }).nullish(),
  lists: z.array(z.object({ text: optionalText, content: optionalText })).optional(),
});
const ashby = z.object({
  id, title: z.string().min(1), jobUrl: z.string().url(),
  descriptionPlain: optionalText, descriptionHtml: optionalText,
  location: optionalText, isRemote: z.boolean().optional(),
  workplaceType: optionalText, employmentType: optionalText,
  publishedAt: optionalText, isListed: z.boolean().optional(),
});

function plain(html: string | null | undefined): string {
  // Greenhouse descriptions may contain entity-encoded HTML.
  let value = html ?? "";
  for (let i = 0; i < 2; i++) {
    const $ = cheerio.load(value);
    $("script, style").remove();
    $("p, br, li, div").prepend(" ");
    value = $("body").text();
  }
  return value.replace(/\s+/g, " ").trim().slice(0, 24000);
}

function date(value?: string | null): string | undefined {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
}

function safePostingUrl(value: string): string {
  const u = new URL(value);
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) throw new Error("Invalid posting URL");
  return u.href;
}

export function normalizeAtsPayload(board: AtsBoard, payload: unknown): RawCollectedJob[] {
  const rows = board.source === "lever"
    ? z.array(z.unknown()).parse(payload)
    : z.object({ jobs: z.array(z.unknown()) }).parse(payload).jobs;
  return rows.flatMap((row) => {
    const base = { source: board.source, companyName: board.slug };
    if (board.source === "greenhouse") {
      const j = greenhouse.parse(row);
      return [RawCollectedJobSchema.parse({ ...base,
        externalId: `${board.region}:${board.slug}:${j.id}`,
        companyName: j.company_name || board.slug, title: j.title,
        sourceUrl: safePostingUrl(j.absolute_url), description: plain(j.content),
        location: j.location?.name ?? undefined,
        // updated_at is not a publication date.
        postedAt: date(j.first_published),
      })];
    }
    if (board.source === "lever") {
      const j = lever.parse(row);
      return [RawCollectedJobSchema.parse({ ...base,
        externalId: `${board.region}:${board.slug}:${j.id}`, title: j.text,
        sourceUrl: safePostingUrl(j.hostedUrl),
        description: plain([j.descriptionPlain || j.description, ...(j.lists ?? []).map(l => `${l.text ?? ""} ${l.content ?? ""}`), j.additionalPlain].filter(Boolean).join("\n")),
        location: j.categories?.location ?? undefined,
        remotePolicy: j.workplaceType ?? undefined,
        employmentType: j.categories?.commitment ?? undefined,
      })];
    }
    const j = ashby.parse(row);
    if (j.isListed === false) return [];
    return [RawCollectedJobSchema.parse({ ...base,
      externalId: `${board.slug}:${j.id}`, title: j.title,
      sourceUrl: safePostingUrl(j.jobUrl), description: plain(j.descriptionPlain || j.descriptionHtml),
      location: j.location ?? undefined, employmentType: j.employmentType ?? undefined,
      remotePolicy: j.workplaceType ?? (j.isRemote === true ? "remote" : undefined),
      postedAt: date(j.publishedAt),
    })];
  });
}

export async function fetchAtsBoard(board: AtsBoard, fetcher: typeof fetch = fetch): Promise<RawCollectedJob[]> {
  // Reconstruct the endpoint from validated board identity, even for internal callers.
  const host = board.source === "greenhouse" ? `boards${board.region === "eu" ? ".eu" : ""}.greenhouse.io`
    : board.source === "lever" ? `jobs${board.region === "eu" ? ".eu" : ""}.lever.co` : "jobs.ashbyhq.com";
  const verified = parseAtsBoard(`https://${host}/${board.slug}`);
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetcher(verified.endpoint, {
      headers: { Accept: "application/json" }, cache: "no-store",
      redirect: "error", signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return normalizeAtsPayload(verified, await res.json());
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
      const retry = res.headers.get("retry-after");
      const seconds = retry == null ? 1 : /^\d+$/.test(retry) ? Number(retry) : Math.ceil((Date.parse(retry) - Date.now()) / 1000);
      // Never retry sooner than requested; long cooldowns wait for the next scheduled run.
      if (!Number.isFinite(seconds) || seconds > 2) throw new Error(`${board.source} HTTP ${res.status}; retry later`);
      await new Promise(resolve => setTimeout(resolve, Math.max(0, seconds) * 1000));
      continue;
    }
    throw new Error(`${board.source} HTTP ${res.status}`);
  }
  return [];
}

export function plannedAtsBoards(params: JobSearchParams): Array<{ url: string; board?: AtsBoard; error?: string }> {
  if (!params.sourcesEnabled.some(s => ["greenhouse", "lever", "ashby"].includes(s))) return [];
  const seen = new Set<string>();
  return params.atsBoardUrls.flatMap<{ url: string; board?: AtsBoard; error?: string }>(url => {
    try {
      const board = parseAtsBoard(url);
      if (!params.sourcesEnabled.includes(board.source) || seen.has(board.endpoint)) return [];
      seen.add(board.endpoint);
      return [{ url, board }];
    } catch (error) {
      return [{ url, error: error instanceof Error ? error.message : "Invalid board" }];
    }
  });
}

export async function collectDirectBoard(board: AtsBoard, params: JobSearchParams, limit: number, fetcher: typeof fetch = fetch): Promise<RawCollectedJob[]> {
  const jobs = await fetchAtsBoard(board, fetcher);
  // Filter the whole response before truncation; otherwise early unrelated jobs exhaust the cap.
  return filterRawJobs(jobs, params).kept.slice(0, Math.max(0, limit));
}
