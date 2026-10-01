import { postingText } from "@/modules/collectors/posting-html";
import {
  fetchRemotiveJobs,
  remotiveCategoryUrl,
  remotiveCompanyDomain,
} from "@/modules/collectors/remotive";
import { DiscoverySignalSchema, hashPayload, type DiscoverySignal } from "./types";

/**
 * Remotive postings as hiring signals for client outreach: a company hiring
 * in a category may need outside help. The HTTP client lives with the job
 * collectors (`collectors/remotive.ts`).
 *
 * Category is the caller's choice (an occupation family, or "design" for
 * client discovery). Omitting it does not fall back to design.
 */
export async function fetchRemotiveSignals(options?: {
  category?: string;
  limit?: number;
}): Promise<DiscoverySignal[]> {
  const limit = options?.limit ?? 25;
  const jobs = await fetchRemotiveJobs(remotiveCategoryUrl(options?.category));

  return jobs.slice(0, limit).map((job) => {
    const parsed = DiscoverySignalSchema.parse({
      source: "remotive" as const,
      externalId: String(job.id),
      companyName: job.company_name,
      companyDomain: remotiveCompanyDomain(job),
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
    return { ...parsed, descriptionExcerpt: postingText(job.description, 2000) };
  });
}
