import { z } from "zod";
import { createHash } from "node:crypto";
import type { JobSource } from "@/modules/search-profile/schemas";

export const RawCollectedJobSchema = z.object({
  source: z.string().min(1),
  externalId: z.string().min(1),
  title: z.string().min(1),
  companyName: z.string().min(1),
  companyDomain: z.string().optional(),
  location: z.string().optional(),
  remotePolicy: z.string().optional(),
  employmentType: z.string().optional(),
  description: z.string().default(""),
  sourceUrl: z.string().min(1),
  postedAt: z.string().optional(),
  salaryText: z.string().optional(),
});

export type RawCollectedJob = z.infer<typeof RawCollectedJobSchema>;

export type CollectorQuery = {
  title: string;
  location: string;
  keywords?: string[];
  postedWithinHours: number;
  maxResults: number;
  source: JobSource;
  /** Extra board search terms (local-language titles); results are merged and filtered. */
  searchTerms?: string[];
};

export function jobFingerprint(job: {
  title: string;
  companyName: string;
  location?: string | null;
  sourceUrl?: string;
}): string {
  const key = [
    job.title.toLowerCase().trim(),
    job.companyName.toLowerCase().trim(),
    (job.location ?? "").toLowerCase().trim(),
  ].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

export function extractDomain(urlOrHost?: string | null): string | undefined {
  if (!urlOrHost) return undefined;
  try {
    const withProtocol = urlOrHost.includes("://")
      ? urlOrHost
      : `https://${urlOrHost}`;
    const host = new URL(withProtocol).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(inc|llc|ltd|gmbh|ag|sa|bv|plc|corp|co)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
