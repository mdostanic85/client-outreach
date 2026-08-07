/**
 * Candidate-facing company facts for a job card.
 * Keep sparse: omit unknowns from the compact view; show them only in the sheet.
 */

export type CompanyHeadcountBand =
  | "1-10"
  | "11-50"
  | "51-200"
  | "201-1000"
  | "1000+"
  | null;

/** Soft employee-review signal — only render when rating + reviewCount exist. */
export type CompanyReputation = {
  rating: number;
  reviewCount: number;
  source: string;
  sourceUrl: string | null;
  fetchedAt: string | null;
} | null;

export type CompanySnapshot = {
  companyId: string | null;
  companyName: string;
  domain: string | null;
  country: string | null;
  /** One-liner from research brief when available. */
  summary: string | null;
  headcountBand: CompanyHeadcountBand;
  salaryText: string | null;
  employmentType: string | null;
  /** Open / recent roles at this company in the lookback window. */
  relatedOpenings: number;
  hiringLookbackDays: number;
  risksAndUnknowns: string[];
  reputation: CompanyReputation;
};

export const HIRING_LOOKBACK_DAYS = 90;

export function formatSalaryDisplay(input: {
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}): string | null {
  const text = input.salaryText?.trim();
  if (text) return text;

  const currency = input.salaryCurrency?.trim() || "";
  const min = input.salaryMin;
  const max = input.salaryMax;
  if (min == null && max == null) return null;

  const fmt = (n: number) => {
    if (n >= 1000) {
      const k = n / 1000;
      return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
    }
    return String(n);
  };

  if (min != null && max != null) {
    return currency ? `${currency} ${fmt(min)}–${fmt(max)}` : `${fmt(min)}–${fmt(max)}`;
  }
  const sole = min ?? max!;
  return currency ? `${currency} ${fmt(sole)}+` : `${fmt(sole)}+`;
}

export function formatHeadcountBand(band: CompanyHeadcountBand): string | null {
  if (!band) return null;
  if (band === "1000+") return "1,000+ people";
  return `${band} people`;
}

export function formatHiringActivity(
  relatedOpenings: number,
  lookbackDays: number,
): string | null {
  if (relatedOpenings <= 0) return null;
  if (relatedOpenings === 1) {
    return `1 other opening in last ${lookbackDays} days`;
  }
  return `${relatedOpenings} other openings in last ${lookbackDays} days`;
}

export function websiteHref(domain: string | null): string | null {
  if (!domain?.trim()) return null;
  const d = domain.trim().replace(/^https?:\/\//i, "");
  return `https://${d}`;
}

/** Color tone for employee review ratings (Glassdoor-style 0–5). */
export function reputationTone(
  rating: number,
  reviewCount: number,
): "good" | "mixed" | "poor" | "insufficient" {
  if (reviewCount < 10) return "insufficient";
  if (rating >= 4) return "good";
  if (rating >= 3) return "mixed";
  return "poor";
}

export function emptyCompanySnapshot(
  companyName: string,
): CompanySnapshot {
  return {
    companyId: null,
    companyName,
    domain: null,
    country: null,
    summary: null,
    headcountBand: null,
    salaryText: null,
    employmentType: null,
    relatedOpenings: 0,
    hiringLookbackDays: HIRING_LOOKBACK_DAYS,
    risksAndUnknowns: [],
    reputation: null,
  };
}
