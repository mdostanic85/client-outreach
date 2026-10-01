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
  /** Remotive category from the occupation family. Absent: search by title only. */
  remotiveCategory?: string;
  /** Occupation family; picks category feeds on boards that publish one per field. */
  family?: string;
  /** City id on boards that filter with one (Infostud `cities[]`, Poslovi `search_cities[]`). */
  cityId?: string;
};

/** Level words that don't help match a title ("Senior", "Lead"…). */
const LEVEL_TOKENS = new Set(["senior", "lead", "staff", "principal", "junior", "head"]);

/**
 * Does a posting title match the query title or one of its synonyms?
 * Accent-insensitive; one meaningful token shared is enough — the
 * pipeline's title filter decides precisely afterwards.
 */
export function titleMatchesQuery(title: string, query: CollectorQuery): boolean {
  const norm = (v: string) =>
    v.toLowerCase().replace(/đ/g, "dj").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const t = norm(title);
  for (const needle of [query.title, ...(query.searchTerms ?? [])]) {
    const n = norm(needle).trim();
    if (!n) continue;
    if (t.includes(n)) return true;
    const tokens = n.split(/[^\p{L}\p{N}+#]+/u).filter((tok) => tok.length > 2 && !LEVEL_TOKENS.has(tok));
    if (tokens.length && tokens.every((tok) => t.includes(tok))) return true;
  }
  return false;
}

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
