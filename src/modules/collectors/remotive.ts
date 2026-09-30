import * as cheerio from "cheerio";
import {
  extractDomain,
  RawCollectedJobSchema,
  titleMatchesQuery,
  type CollectorQuery,
  type RawCollectedJob,
} from "./types";

const REMOTIVE_API = "https://remotive.com/api/remote-jobs";

type RemotiveJob = {
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
  const skip =
    /(remotive\.com|linkedin\.com|twitter\.com|x\.com|facebook\.com)/i;
  const candidates = hrefs
    .map((h) => extractDomain(h))
    .filter((d): d is string => !!d && !skip.test(d));
  if (candidates.length === 0) return undefined;
  const tokens = companyName
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  return (
    candidates.find((d) => tokens.some((t) => d.includes(t))) ?? candidates[0]
  );
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

/**
 * Fetch Remotive jobs matching the query title in the family's category.
 */
export async function collectRemotive(
  query: CollectorQuery,
): Promise<RawCollectedJob[]> {
  const url = remotiveSearchUrl(query.title, query.remotiveCategory);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);

  const data = (await res.json()) as { jobs?: RemotiveJob[] };
  const matched = (data.jobs ?? []).filter((job) => titleMatchesQuery(job.title, query));

  // No silent fallback to the entire Remotive board — that floods the
  // pipeline with unrelated roles (data labeling, support, etc.).
  const slice = matched.slice(0, query.maxResults);

  return slice.map((job) =>
    RawCollectedJobSchema.parse({
      source: "remotive",
      externalId: String(job.id),
      title: job.title,
      companyName: job.company_name,
      companyDomain: domainFromDescription(job.description, job.company_name),
      location: job.candidate_required_location,
      remotePolicy: "remote",
      employmentType: job.job_type,
      description: descriptionText(job.description),
      sourceUrl: job.url,
      postedAt: job.publication_date,
    }),
  );
}
