import * as cheerio from "cheerio";
import {
  DiscoverySignalSchema,
  extractDomain,
  hashPayload,
  type DiscoverySignal,
} from "./types";

const ARBEITNOW_API = "https://www.arbeitnow.com/api/job-board-api";

type ArbeitnowJob = {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote?: boolean;
  url: string;
  /** API sometimes returns a dict (`{0: "Sales", ...}`) instead of an array. */
  tags?: string[] | Record<string, string>;
  job_types?: string[] | Record<string, string>;
  location?: string;
  created_at?: number;
};

type ArbeitnowResponse = {
  data: ArbeitnowJob[];
};

/** Normalize Arbeitnow list fields that may arrive as arrays or keyed objects. */
function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).filter(
      (v): v is string => typeof v === "string",
    );
  }
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function descriptionExcerpt(html: string | undefined): string {
  if (!html) return "";
  const $ = cheerio.load(html);
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);
}

function domainFromDescription(html: string | undefined, companyName: string): string | undefined {
  if (!html) return undefined;
  const $ = cheerio.load(html);
  const hrefs: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) hrefs.push(href);
  });

  const skip =
    /(arbeitnow\.com|linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|notion\.so|google\.com)/i;
  const candidates = hrefs
    .map((h) => extractDomain(h))
    .filter((d): d is string => !!d && !skip.test(d));

  if (candidates.length === 0) return undefined;

  const tokens = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const matched = candidates.find((d) => tokens.some((t) => d.includes(t)));
  return matched ?? candidates[0];
}

/**
 * Fetch European / ATS-sourced design-relevant jobs from Arbeitnow.
 */
export async function fetchArbeitnowSignals(options?: {
  pages?: number;
  limit?: number;
}): Promise<DiscoverySignal[]> {
  const pages = options?.pages ?? 2;
  const limit = options?.limit ?? 80;
  const jobs: ArbeitnowJob[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const url = `${ARBEITNOW_API}?page=${page}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Arbeitnow fetch failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as ArbeitnowResponse;
    jobs.push(...(data.data ?? []));
    if ((data.data ?? []).length === 0) break;
  }

  const designish = jobs.filter((job) => {
    const hay = `${job.title} ${asStringList(job.tags).join(" ")}`.toLowerCase();
    return /design|ux|ui|product design|creative|brand/.test(hay);
  });

  return designish.slice(0, limit).map((job) => {
    const excerpt = descriptionExcerpt(job.description);
    const publishedAt =
      typeof job.created_at === "number"
        ? new Date(job.created_at * 1000).toISOString()
        : undefined;

    const parsed = DiscoverySignalSchema.parse({
      source: "arbeitnow" as const,
      externalId: job.slug,
      companyName: job.company_name,
      companyDomain: domainFromDescription(job.description, job.company_name),
      title: job.title,
      location: job.location,
      employmentType: asStringList(job.job_types).join(", ") || undefined,
      publishedAt,
      sourceUrl: job.url,
      rawHash: hashPayload({
        slug: job.slug,
        title: job.title,
        company: job.company_name,
        created: job.created_at,
      }),
    });

    return { ...parsed, descriptionExcerpt: excerpt };
  });
}
