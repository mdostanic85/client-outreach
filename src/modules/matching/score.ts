import { z } from "zod";
import { STRONG_MATCH_MIN, WORTH_A_LOOK_MIN } from "@/modules/matching/tiers";

/** Ordered dimension keys for weighted job match scoring. */
export const JOB_MATCH_DIM_KEYS = [
  "skills",
  "seniority",
  "experience",
  "locationTimezone",
  "employmentType",
  "compensation",
  "industry",
  "portfolioFit",
  "language",
] as const;

export type JobMatchDimKey = (typeof JOB_MATCH_DIM_KEYS)[number];

export const JOB_MATCH_DIM_LABELS: Record<JobMatchDimKey, string> = {
  skills: "Skills",
  seniority: "Seniority",
  experience: "Experience",
  locationTimezone: "Location / TZ",
  employmentType: "Employment type",
  compensation: "Compensation",
  industry: "Industry",
  portfolioFit: "Portfolio fit",
  language: "Language",
};

/** Default weights — sum to 100. */
export const JOB_MATCH_WEIGHTS: Record<JobMatchDimKey, number> = {
  skills: 25,
  seniority: 15,
  experience: 15,
  locationTimezone: 15,
  employmentType: 8,
  compensation: 7,
  industry: 5,
  portfolioFit: 5,
  language: 5,
};

export const MatchDimSchema = z.object({
  score: z.number().min(0).max(100),
  evidence: z.string().max(200).optional(),
});

export type MatchDim = z.infer<typeof MatchDimSchema>;

export const MatchDimensionsSchema = z.object({
  skills: MatchDimSchema,
  seniority: MatchDimSchema,
  experience: MatchDimSchema,
  locationTimezone: MatchDimSchema,
  employmentType: MatchDimSchema,
  compensation: MatchDimSchema.nullable(),
  industry: MatchDimSchema,
  portfolioFit: MatchDimSchema,
  language: MatchDimSchema,
});

export type MatchDimensions = z.infer<typeof MatchDimensionsSchema>;

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * Merge stored/partial weights with defaults. Unknown keys ignored.
 * Negative or non-finite values fall back to default for that key.
 */
export function resolveJobMatchWeights(
  stored?: Partial<Record<JobMatchDimKey, number>> | null,
): Record<JobMatchDimKey, number> {
  const out = { ...JOB_MATCH_WEIGHTS };
  if (!stored) return out;
  for (const key of JOB_MATCH_DIM_KEYS) {
    const v = stored[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Weighted average of present dimensions. Null / missing dims (e.g. unknown
 * compensation) are renormalized out of the denominator.
 * Final total is calculated in code — never trust a model total.
 */
export function calculateMatchScore(
  dims: MatchDimensions | Record<JobMatchDimKey, MatchDim | null>,
  weights: Record<JobMatchDimKey, number> = JOB_MATCH_WEIGHTS,
): number {
  let num = 0;
  let den = 0;
  for (const key of JOB_MATCH_DIM_KEYS) {
    const d = dims[key];
    const w = weights[key] ?? 0;
    if (d == null || !Number.isFinite(d.score) || w <= 0) continue;
    num += clampScore(d.score) * w;
    den += w;
  }
  if (den === 0) return 0;
  return Math.round((num / den) * 10) / 10;
}

export type SoftPenaltyContext = {
  eligibility: "eligible" | "borderline" | "ineligible";
  remoteFit?: {
    status: "pass" | "unclear" | "fail";
    timezoneOverlap: "full" | "partial" | "poor" | "unknown";
  } | null;
  remoteRequired: boolean;
};

/** Soft caps on locationTimezone — never a hard drop for ambiguous EU remote. */
export function applySoftPenalties(
  dimensions: MatchDimensions,
  ctx: SoftPenaltyContext,
): MatchDimensions {
  const next: MatchDimensions = {
    ...dimensions,
    locationTimezone: { ...dimensions.locationTimezone },
    compensation:
      dimensions.compensation == null
        ? null
        : { ...dimensions.compensation },
  };

  let loc = next.locationTimezone.score;

  if (ctx.remoteFit?.status === "unclear" && ctx.remoteRequired) {
    loc = Math.min(loc, 55);
  }
  if (
    ctx.remoteFit?.timezoneOverlap === "poor" &&
    ctx.remoteFit.status === "pass"
  ) {
    loc = Math.min(loc, 65);
  }

  next.locationTimezone = {
    ...next.locationTimezone,
    score: clampScore(loc),
  };

  return next;
}

/**
 * Soft-penalty dims → weighted total → borderline cap at 69 (cannot be Strong).
 */
export function finalizeMatchScore(
  dimensions: MatchDimensions,
  ctx: SoftPenaltyContext,
  weights: Record<JobMatchDimKey, number> = JOB_MATCH_WEIGHTS,
): { dimensions: MatchDimensions; matchScore: number } {
  const adjusted = applySoftPenalties(dimensions, ctx);
  let matchScore = calculateMatchScore(adjusted, weights);
  if (ctx.eligibility === "borderline") {
    matchScore = Math.min(matchScore, STRONG_MATCH_MIN - 1);
  }
  return { dimensions: adjusted, matchScore };
}

/**
 * Code-owned recommendation from score + eligibility + remote.
 * Model suggestion is ignored.
 */
export function mapMatchRecommendation(input: {
  matchScore: number;
  eligibility: "eligible" | "borderline" | "ineligible";
  remoteFit?: { status: "pass" | "unclear" | "fail" } | null;
  remoteRequired: boolean;
}): "apply" | "consider" | "skip" {
  const { matchScore, eligibility, remoteFit, remoteRequired } = input;

  if (eligibility === "ineligible") return "skip";
  if (remoteRequired && remoteFit?.status === "fail") return "skip";
  if (matchScore < WORTH_A_LOOK_MIN) return "skip";

  if (
    eligibility === "eligible" &&
    matchScore >= STRONG_MATCH_MIN &&
    (!remoteRequired || remoteFit?.status === "pass")
  ) {
    return "apply";
  }

  return "consider";
}

/** Top dimensions by score for UI previews (skips null). */
export function topMatchDimensions(
  dimensions: MatchDimensions | null | undefined,
  limit = 3,
): Array<{ key: JobMatchDimKey; label: string; score: number; evidence?: string }> {
  if (!dimensions) return [];
  const rows: Array<{
    key: JobMatchDimKey;
    label: string;
    score: number;
    evidence?: string;
  }> = [];
  for (const key of JOB_MATCH_DIM_KEYS) {
    const d = dimensions[key];
    if (d == null) continue;
    rows.push({
      key,
      label: JOB_MATCH_DIM_LABELS[key],
      score: d.score,
      evidence: d.evidence,
    });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, limit);
}

export function parseDimensionsFromScoreJson(
  scoreJson: string | null | undefined,
): MatchDimensions | null {
  if (!scoreJson) return null;
  try {
    const parsed = JSON.parse(scoreJson) as { dimensions?: unknown };
    if (!parsed?.dimensions) return null;
    const result = MatchDimensionsSchema.safeParse(parsed.dimensions);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
