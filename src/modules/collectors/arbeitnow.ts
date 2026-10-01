import { RawCollectedJobSchema, titleMatchesQuery, type CollectorQuery, type RawCollectedJob } from "./types";
import { asStringList, companyDomainFromPosting, postingText } from "./posting-html";

/**
 * Arbeitnow public job board API. This module owns the HTTP contract; job
 * search maps results to `RawCollectedJob` here, and client-outreach
 * discovery maps the same rows to hiring signals (`discovery/arbeitnow.ts`).
 */

const ARBEITNOW_API = "https://www.arbeitnow.com/api/job-board-api";
const ARBEITNOW_HOST = /arbeitnow\.com/i;

export type ArbeitnowJob = {
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
  /** Unix seconds. */
  created_at?: number;
};

/**
 * One page of the board (newest first). An HTTP error status comes back as a
 * value so callers choose between stopping and failing; network errors throw.
 */
export async function fetchArbeitnowPage(
  page: number,
): Promise<{ ok: true; jobs: ArbeitnowJob[] } | { ok: false; status: number }> {
  const res = await fetch(`${ARBEITNOW_API}?page=${page}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status };
  const data = (await res.json()) as { data?: ArbeitnowJob[] };
  return { ok: true, jobs: data.data ?? [] };
}

/** Employer website guessed from links in the Arbeitnow posting body. */
export function arbeitnowCompanyDomain(job: ArbeitnowJob): string | undefined {
  return companyDomainFromPosting(job.description, job.company_name, ARBEITNOW_HOST);
}

export function arbeitnowPostedAt(job: ArbeitnowJob): string | undefined {
  return typeof job.created_at === "number"
    ? new Date(job.created_at * 1000).toISOString()
    : undefined;
}

export function arbeitnowJobTypes(job: ArbeitnowJob): string[] {
  return asStringList(job.job_types);
}

export async function collectArbeitnow(
  query: CollectorQuery,
): Promise<RawCollectedJob[]> {
  const pages = 3;
  const all: ArbeitnowJob[] = [];
  for (let page = 1; page <= pages; page++) {
    const result = await fetchArbeitnowPage(page);
    // Keep what the earlier pages returned; a refused page ends paging.
    if (!result.ok) break;
    all.push(...result.jobs);
  }

  // Only title matches — never dump the whole board into the pipeline.
  const slice = all
    .filter((job) => titleMatchesQuery(job.title, query))
    .slice(0, query.maxResults);

  return slice.map((job) =>
    RawCollectedJobSchema.parse({
      source: "arbeitnow",
      externalId: job.slug,
      title: job.title,
      companyName: job.company_name,
      companyDomain: arbeitnowCompanyDomain(job),
      location: job.location,
      remotePolicy: job.remote ? "remote" : undefined,
      employmentType: arbeitnowJobTypes(job)[0],
      description: postingText(job.description, 12_000),
      sourceUrl: job.url,
      postedAt: arbeitnowPostedAt(job),
    }),
  );
}
