import * as cheerio from "cheerio";
import {
  extractDomain,
  RawCollectedJobSchema,
  titleMatchesQuery,
  type CollectorQuery,
  type RawCollectedJob,
} from "./types";

const ARBEITNOW_API = "https://www.arbeitnow.com/api/job-board-api";

type ArbeitnowJob = {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote?: boolean;
  url: string;
  job_types?: string[] | Record<string, string>;
  location?: string;
  created_at?: number;
};

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).filter(
      (v): v is string => typeof v === "string",
    );
  }
  return [];
}

function descriptionText(html: string | undefined): string {
  if (!html) return "";
  const $ = cheerio.load(html);
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 12000);
}

function domainFromDescription(
  html: string | undefined,
  companyName: string,
): string | undefined {
  if (!html) return undefined;
  const $ = cheerio.load(html);
  const hrefs: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) hrefs.push(href);
  });
  const skip = /(arbeitnow\.com|linkedin\.com|twitter\.com|x\.com)/i;
  const candidates = hrefs
    .map((h) => extractDomain(h))
    .filter((d): d is string => !!d && !skip.test(d));
  if (!candidates.length) return undefined;
  const tokens = companyName
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  return (
    candidates.find((d) => tokens.some((t) => d.includes(t))) ?? candidates[0]
  );
}

export async function collectArbeitnow(
  query: CollectorQuery,
): Promise<RawCollectedJob[]> {
  const pages = 3;
  const all: ArbeitnowJob[] = [];
  for (let page = 1; page <= pages; page++) {
    const res = await fetch(`${ARBEITNOW_API}?page=${page}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) break;
    const data = (await res.json()) as { data?: ArbeitnowJob[] };
    all.push(...(data.data ?? []));
  }

  // Only title matches — never dump the whole board into the pipeline.
  const slice = all
    .filter((job) => titleMatchesQuery(job.title, query))
    .slice(0, query.maxResults);

  return slice.map((job) => {
    const types = asStringList(job.job_types);
    return RawCollectedJobSchema.parse({
      source: "arbeitnow",
      externalId: job.slug,
      title: job.title,
      companyName: job.company_name,
      companyDomain: domainFromDescription(job.description, job.company_name),
      location: job.location,
      remotePolicy: job.remote ? "remote" : undefined,
      employmentType: types[0],
      description: descriptionText(job.description),
      sourceUrl: job.url,
      postedAt:
        job.created_at != null
          ? new Date(job.created_at * 1000).toISOString()
          : undefined,
    });
  });
}
