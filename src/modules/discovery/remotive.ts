import * as cheerio from "cheerio";
import {
  DiscoverySignalSchema,
  extractDomain,
  hashPayload,
  type DiscoverySignal,
} from "./types";

const REMOTIVE_API = "https://remotive.com/api/remote-jobs";

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  description?: string;
  tags?: string[];
};

type RemotiveResponse = {
  "job-count": number;
  jobs: RemotiveJob[];
};

function domainFromDescription(html: string | undefined, companyName: string): string | undefined {
  if (!html) return undefined;
  const $ = cheerio.load(html);
  const hrefs: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) hrefs.push(href);
  });

  const skip = /(remotive\.com|linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|notion\.so|google\.com)/i;
  const candidates = hrefs
    .map((h) => extractDomain(h))
    .filter((d): d is string => !!d && !skip.test(d));

  if (candidates.length === 0) return undefined;

  // Prefer a domain that loosely matches company name tokens
  const tokens = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const matched = candidates.find((d) => tokens.some((t) => d.includes(t)));
  return matched ?? candidates[0];
}

function descriptionExcerpt(html: string | undefined): string {
  if (!html) return "";
  const $ = cheerio.load(html);
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);
}

/**
 * Fetch design/product-relevant remote jobs from Remotive.
 * Phase 0: one adapter only.
 */
export async function fetchRemotiveSignals(options?: {
  category?: string;
  limit?: number;
}): Promise<DiscoverySignal[]> {
  const category = options?.category ?? "design";
  const limit = options?.limit ?? 25;
  const url = `${REMOTIVE_API}?category=${encodeURIComponent(category)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Remotive fetch failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as RemotiveResponse;
  const jobs = (data.jobs ?? []).slice(0, limit);

  return jobs.map((job) => {
    const excerpt = descriptionExcerpt(job.description);
    const parsed = DiscoverySignalSchema.parse({
      source: "remotive" as const,
      externalId: String(job.id),
      companyName: job.company_name,
      companyDomain: domainFromDescription(job.description, job.company_name),
      title: job.title,
      location: job.candidate_required_location,
      employmentType: job.job_type,
      publishedAt: job.publication_date,
      sourceUrl: job.url,
      rawHash: hashPayload({
        id: job.id,
        title: job.title,
        company: job.company_name,
        published: job.publication_date,
      }),
    });
    return { ...parsed, descriptionExcerpt: excerpt };
  });
}
