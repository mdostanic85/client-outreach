import { postingText } from "@/modules/collectors/posting-html";
import {
  arbeitnowCompanyDomain,
  arbeitnowJobTypes,
  arbeitnowPostedAt,
  fetchArbeitnowPage,
  type ArbeitnowJob,
} from "@/modules/collectors/arbeitnow";
import { titleMatchesQuery, type CollectorQuery } from "@/modules/collectors/types";
import { DiscoverySignalSchema, hashPayload, type DiscoverySignal } from "./types";

/**
 * Arbeitnow postings as hiring signals for client outreach. The HTTP client
 * lives with the job collectors (`collectors/arbeitnow.ts`).
 */

/**
 * Keep a posting when it shares the occupation's names. With no titles,
 * nothing is dropped here — callers that still want a design list filter later.
 */
export function arbeitnowTitleAllowed(title: string, titles: string[] | undefined): boolean {
  const needles = (titles ?? []).map((value) => value.trim()).filter(Boolean);
  if (!needles.length) return true;
  const query: CollectorQuery = {
    title: needles[0]!,
    searchTerms: needles.slice(1),
    location: "",
    postedWithinHours: 24,
    maxResults: 1,
    source: "arbeitnow",
  };
  return titleMatchesQuery(title, query);
}

/**
 * Fetch European / ATS-sourced jobs from Arbeitnow, matched to occupation titles.
 */
export async function fetchArbeitnowSignals(options?: {
  pages?: number;
  limit?: number;
  titles?: string[];
}): Promise<DiscoverySignal[]> {
  const pages = options?.pages ?? 2;
  const limit = options?.limit ?? 80;
  const jobs: ArbeitnowJob[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const result = await fetchArbeitnowPage(page);
    if (!result.ok) throw new Error(`Arbeitnow fetch failed: HTTP ${result.status}`);
    jobs.push(...result.jobs);
    if (result.jobs.length === 0) break;
  }

  const matched = jobs.filter((job) => arbeitnowTitleAllowed(job.title, options?.titles));

  return matched.slice(0, limit).map((job) => {
    const parsed = DiscoverySignalSchema.parse({
      source: "arbeitnow" as const,
      externalId: job.slug,
      companyName: job.company_name,
      companyDomain: arbeitnowCompanyDomain(job),
      title: job.title,
      location: job.location,
      employmentType: arbeitnowJobTypes(job).join(", ") || undefined,
      publishedAt: arbeitnowPostedAt(job),
      sourceUrl: job.url,
      rawHash: hashPayload({
        slug: job.slug,
        title: job.title,
        company: job.company_name,
        created: job.created_at,
      }),
    });
    return { ...parsed, descriptionExcerpt: postingText(job.description, 2000) };
  });
}
