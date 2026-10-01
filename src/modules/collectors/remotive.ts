import { RawCollectedJobSchema, titleMatchesQuery, type CollectorQuery, type RawCollectedJob } from "./types";
import { companyDomainFromPosting, postingText } from "./posting-html";

/**
 * Remotive public API. This module owns the HTTP contract; job search maps
 * results to `RawCollectedJob` here, and client-outreach discovery maps the
 * same rows to hiring signals (`discovery/remotive.ts`).
 */

const REMOTIVE_API = "https://remotive.com/api/remote-jobs";
const REMOTIVE_HOST = /remotive\.com/i;

export type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  description?: string;
  category?: string;
};

export async function fetchRemotiveJobs(url: string): Promise<RemotiveJob[]> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);
  const data = (await res.json()) as { jobs?: RemotiveJob[] };
  return data.jobs ?? [];
}

/** Employer website guessed from links in the Remotive posting body. */
export function remotiveCompanyDomain(job: RemotiveJob): string | undefined {
  return companyDomainFromPosting(job.description, job.company_name, REMOTIVE_HOST);
}

/** Remotive's search is literal; level words only narrow it. */
function searchTerm(title: string): string {
  return (
    title
      .replace(/\b(senior|sr\.?|junior|jr\.?|lead|staff|principal|head of)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || title
  );
}

/** Category comes from the occupation family. No category means a title search, not design. */
export function remotiveSearchUrl(title: string, category?: string): string {
  const url = new URL(REMOTIVE_API);
  url.searchParams.set("search", searchTerm(title));
  url.searchParams.set("limit", "100");
  if (category) url.searchParams.set("category", category);
  return url.href;
}

/** Latest postings in one category (client-outreach discovery). */
export function remotiveCategoryUrl(category?: string): string {
  const url = new URL(REMOTIVE_API);
  if (category) url.searchParams.set("category", category);
  return url.href;
}

/**
 * Fetch Remotive jobs matching the query title in the family's category.
 */
export async function collectRemotive(
  query: CollectorQuery,
): Promise<RawCollectedJob[]> {
  const jobs = await fetchRemotiveJobs(remotiveSearchUrl(query.title, query.remotiveCategory));
  const matched = jobs.filter((job) => titleMatchesQuery(job.title, query));

  // No silent fallback to the entire Remotive board — that floods the
  // pipeline with unrelated roles (data labeling, support, etc.).
  const slice = matched.slice(0, query.maxResults);

  return slice.map((job) =>
    RawCollectedJobSchema.parse({
      source: "remotive",
      externalId: String(job.id),
      title: job.title,
      companyName: job.company_name,
      companyDomain: remotiveCompanyDomain(job),
      location: job.candidate_required_location,
      remotePolicy: "remote",
      employmentType: job.job_type,
      description: postingText(job.description, 12_000),
      sourceUrl: job.url,
      postedAt: job.publication_date,
    }),
  );
}
