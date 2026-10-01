import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, leads, suppressions } from "@/db/schema";
import { ACTIVE_OUTREACH_STATES } from "@/modules/leads/states";
import { extractDomain, normalizeCompanyName } from "@/modules/companies/identity";
import type { DiscoverySignal } from "./types";

export type TargetFilters = {
  countries?: string[];
  excludedIndustries?: string[];
  titleInclude?: string[];
  titleExclude?: string[];
  maxAgeDays?: number;
  excludedRegions?: string[];
  categories?: string[];
};

export type FilterStats = {
  raw: number;
  afterNormalize: number;
  duplicatesRemoved: number;
  staleRejected: number;
  industryRejected: number;
  regionRejected: number;
  suppressedRejected: number;
  contactedRejected: number;
  kept: number;
};

export type FilteredCandidate = {
  signal: DiscoverySignal;
  companyKey: string;
  normalizedName: string;
  domain?: string;
};

const DEFAULT_FILTERS: Required<
  Pick<TargetFilters, "maxAgeDays" | "titleInclude" | "excludedIndustries">
> = {
  maxAgeDays: 45,
  titleInclude: [
    "design",
    "designer",
    "ux",
    "ui",
    "product design",
    "design system",
    "head of design",
    "design lead",
    "creative",
  ],
  excludedIndustries: ["adult", "gambling", "crypto casino"],
};

export function loadTargetFilters(json: string): TargetFilters {
  try {
    return { ...DEFAULT_FILTERS, ...(JSON.parse(json || "{}") as TargetFilters) };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

export async function getSuppressedDomains(): Promise<Set<string>> {
  const rows = await getDb().select().from(suppressions);
  const set = new Set<string>();
  for (const row of rows) {
    if (row.domain) set.add(row.domain.toLowerCase());
    if (row.email) {
      const domain = row.email.split("@")[1]?.toLowerCase();
      if (domain) set.add(domain);
    }
  }
  return set;
}

export async function getActiveContactedDomains(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ domain: companies.domain })
    .from(leads)
    .innerJoin(companies, eq(leads.companyId, companies.id))
    .where(
      and(
        inArray(leads.state, ACTIVE_OUTREACH_STATES),
        isNotNull(companies.domain),
      ),
    );
  return new Set(
    rows
      .map((r) => r.domain?.toLowerCase())
      .filter((d): d is string => !!d),
  );
}

function isStale(publishedAt: string | undefined, maxAgeDays: number): boolean {
  if (!publishedAt) return false;
  const ts =
    /^\d+$/.test(publishedAt)
      ? Number(publishedAt) * (publishedAt.length <= 10 ? 1000 : 1)
      : Date.parse(publishedAt);
  if (Number.isNaN(ts)) return false;
  const ageMs = Date.now() - ts;
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

function matchesTitleInclude(title: string, include: string[]): boolean {
  if (include.length === 0) return true;
  const lower = title.toLowerCase();
  return include.some((t) => lower.includes(t.toLowerCase()));
}

function matchesExcludedIndustry(
  signal: DiscoverySignal,
  excluded: string[],
): boolean {
  if (excluded.length === 0) return false;
  const hay = `${signal.title} ${signal.companyName}`.toLowerCase();
  return excluded.some((e) => hay.includes(e.toLowerCase()));
}

function matchesExcludedRegion(
  location: string | undefined,
  excluded: string[],
): boolean {
  if (!location || excluded.length === 0) return false;
  const lower = location.toLowerCase();
  return excluded.some((r) => lower.includes(r.toLowerCase()));
}

/**
 * Deterministic prefilters before any LLM call.
 * Collapses multiple postings from one company into one candidate.
 */
export async function applyDeterministicFilters(
  signals: DiscoverySignal[],
  filters: TargetFilters,
): Promise<{ candidates: FilteredCandidate[]; stats: FilterStats }> {
  const maxAgeDays = filters.maxAgeDays ?? DEFAULT_FILTERS.maxAgeDays;
  const titleInclude = filters.titleInclude ?? DEFAULT_FILTERS.titleInclude;
  const excludedIndustries =
    filters.excludedIndustries ?? DEFAULT_FILTERS.excludedIndustries;
  const excludedRegions = filters.excludedRegions ?? [];
  const countryAllow = (filters.countries ?? []).map((c) => c.toLowerCase());

  const suppressed = await getSuppressedDomains();
  const contacted = await getActiveContactedDomains();

  const stats: FilterStats = {
    raw: signals.length,
    afterNormalize: 0,
    duplicatesRemoved: 0,
    staleRejected: 0,
    industryRejected: 0,
    regionRejected: 0,
    suppressedRejected: 0,
    contactedRejected: 0,
    kept: 0,
  };

  const byKey = new Map<string, FilteredCandidate>();
  const seenUrls = new Set<string>();
  const seenDomains = new Set<string>();

  for (const signal of signals) {
    const normalizedName = normalizeCompanyName(signal.companyName);
    const domain = signal.companyDomain ?? extractDomain(signal.sourceUrl);
    const companyKey = domain ?? normalizedName;

    if (!normalizedName) continue;
    stats.afterNormalize += 1;

    if (seenUrls.has(signal.sourceUrl)) {
      stats.duplicatesRemoved += 1;
      continue;
    }
    seenUrls.add(signal.sourceUrl);

    if (domain && seenDomains.has(domain) && byKey.has(companyKey)) {
      stats.duplicatesRemoved += 1;
      // collapse: keep first signal for company
      continue;
    }
    if (domain) seenDomains.add(domain);

    if (isStale(signal.publishedAt, maxAgeDays)) {
      stats.staleRejected += 1;
      continue;
    }

    if (!matchesTitleInclude(signal.title, titleInclude)) {
      // soft filter — still allow through for Remotive design category feeds
      // but reject obvious mismatches when titleInclude is configured narrowly
      if (titleInclude.length > 0 && signal.source === "arbeitnow") {
        stats.industryRejected += 1;
        continue;
      }
    }

    if (matchesExcludedIndustry(signal, excludedIndustries)) {
      stats.industryRejected += 1;
      continue;
    }

    if (matchesExcludedRegion(signal.location, excludedRegions)) {
      stats.regionRejected += 1;
      continue;
    }

    if (countryAllow.length > 0 && signal.location) {
      const loc = signal.location.toLowerCase();
      const ok = countryAllow.some((c) => loc.includes(c));
      if (!ok && !/worldwide|remote|anywhere/i.test(loc)) {
        stats.regionRejected += 1;
        continue;
      }
    }

    if (domain && suppressed.has(domain)) {
      stats.suppressedRejected += 1;
      continue;
    }

    if (domain && contacted.has(domain)) {
      stats.contactedRejected += 1;
      continue;
    }

    if (!byKey.has(companyKey)) {
      byKey.set(companyKey, {
        signal: { ...signal, companyDomain: domain },
        companyKey,
        normalizedName,
        domain,
      });
    } else {
      stats.duplicatesRemoved += 1;
    }
  }

  const candidates = [...byKey.values()];
  stats.kept = candidates.length;
  return { candidates, stats };
}
