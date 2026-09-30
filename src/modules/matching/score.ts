import { z } from "zod";
import type { OccupationFamily } from "@/modules/occupations/families";
import { STRONG_MATCH_MIN, WORTH_A_LOOK_MIN } from "@/modules/matching/tiers";

/** Ordered dimension keys for weighted job match scoring (any occupation). */
export const JOB_MATCH_DIM_KEYS = [
  "skills",
  "experience",
  "seniority",
  "requirements",
  "location",
  "schedule",
  "compensation",
  "evidenceFit",
  "industry",
  "language",
] as const;

export type JobMatchDimKey = (typeof JOB_MATCH_DIM_KEYS)[number];

export const JOB_MATCH_DIM_LABELS: Record<JobMatchDimKey, string> = {
  skills: "Skills",
  experience: "Experience",
  seniority: "Level",
  requirements: "Requirements",
  location: "Location",
  schedule: "Schedule",
  compensation: "Pay",
  evidenceFit: "Proof of work",
  industry: "Industry",
  language: "Language",
};

/** Keys used before the occupation-neutral dimensions. */
const LEGACY_DIM_KEYS: Record<string, JobMatchDimKey> = {
  locationTimezone: "location",
  employmentType: "schedule",
  portfolioFit: "evidenceFit",
};

/** Default weights (unknown family) — sum to 100. */
export const JOB_MATCH_WEIGHTS: Record<JobMatchDimKey, number> = {
  skills: 22,
  experience: 15,
  seniority: 10,
  requirements: 12,
  location: 14,
  schedule: 7,
  compensation: 7,
  evidenceFit: 5,
  industry: 4,
  language: 4,
};

/**
 * Weights per occupation family — each sums to 100. Transport and healthcare
 * lean on requirements (licences) and location; tech on skills and proof of
 * work. Learning proposals can still tune them per account.
 */
export const FAMILY_MATCH_WEIGHTS: Record<OccupationFamily, Record<JobMatchDimKey, number>> = {
  tech_digital: { skills: 25, experience: 15, seniority: 12, requirements: 5, location: 13, schedule: 5, compensation: 7, evidenceFit: 10, industry: 4, language: 4 },
  office_business: { skills: 20, experience: 18, seniority: 12, requirements: 8, location: 14, schedule: 6, compensation: 8, evidenceFit: 4, industry: 5, language: 5 },
  healthcare: { skills: 15, experience: 15, seniority: 3, requirements: 25, location: 15, schedule: 12, compensation: 7, evidenceFit: 0, industry: 3, language: 5 },
  trades: { skills: 20, experience: 18, seniority: 3, requirements: 20, location: 16, schedule: 8, compensation: 8, evidenceFit: 2, industry: 2, language: 3 },
  transport_logistics: { skills: 10, experience: 15, seniority: 2, requirements: 28, location: 20, schedule: 12, compensation: 8, evidenceFit: 0, industry: 1, language: 4 },
  hospitality_retail: { skills: 15, experience: 18, seniority: 3, requirements: 12, location: 18, schedule: 16, compensation: 8, evidenceFit: 2, industry: 3, language: 5 },
  education: { skills: 15, experience: 15, seniority: 3, requirements: 25, location: 16, schedule: 8, compensation: 7, evidenceFit: 3, industry: 3, language: 5 },
};

export function defaultWeightsFor(
  family: OccupationFamily | null | undefined,
): Record<JobMatchDimKey, number> {
  return { ...(family ? FAMILY_MATCH_WEIGHTS[family] : JOB_MATCH_WEIGHTS) };
}

export const MatchDimSchema = z.object({
  score: z.number().min(0).max(100),
  evidence: z.string().max(200).optional(),
});

export type MatchDim = z.infer<typeof MatchDimSchema>;

/** Renames pre-v5 keys so stored scores and stored weights keep working. */
export function renameLegacyDimKeys<T>(raw: T): T {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  for (const [legacy, key] of Object.entries(LEGACY_DIM_KEYS)) {
    if (legacy in out) {
      if (!(key in out)) out[key] = out[legacy];
      delete out[legacy];
    }
  }
  return out as T;
}

const optionalDim = MatchDimSchema.nullable()
  .optional()
  .transform((d) => d ?? null);

/**
 * The model scores what the posting and profile give evidence for and
 * returns null for dimensions that don't apply (no level in this trade, no
 * portfolio for drivers, no pay signal). Null dims drop out of the total.
 */
export const MatchDimensionsSchema = z.preprocess(
  renameLegacyDimKeys,
  z.object({
    skills: MatchDimSchema,
    experience: MatchDimSchema,
    seniority: optionalDim,
    requirements: optionalDim,
    location: MatchDimSchema,
    schedule: optionalDim,
    compensation: optionalDim,
    evidenceFit: optionalDim,
    industry: optionalDim,
    language: optionalDim,
  }),
);

export type MatchDimensions = z.infer<typeof MatchDimensionsSchema>;

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * Merge stored/partial weights with defaults (the family's when known).
 * Legacy keys are renamed; unknown keys ignored. Negative or non-finite
 * values fall back to the default for that key.
 */
export function resolveJobMatchWeights(
  stored?: Partial<Record<JobMatchDimKey, number>> | null,
  family?: OccupationFamily | null,
): Record<JobMatchDimKey, number> {
  const out = defaultWeightsFor(family);
  if (!stored) return out;
  const renamed = renameLegacyDimKeys(stored);
  for (const key of JOB_MATCH_DIM_KEYS) {
    const v = renamed[key];
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
  dims: MatchDimensions | Partial<Record<JobMatchDimKey, MatchDim | null>>,
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

/** Soft caps on location — never a hard drop for ambiguous EU remote. */
export function applySoftPenalties(
  dimensions: MatchDimensions,
  ctx: SoftPenaltyContext,
): MatchDimensions {
  const next: MatchDimensions = {
    ...dimensions,
    location: { ...dimensions.location },
    compensation:
      dimensions.compensation == null
        ? null
        : { ...dimensions.compensation },
  };

  let loc = next.location.score;

  if (ctx.remoteFit?.status === "unclear" && ctx.remoteRequired) {
    loc = Math.min(loc, 55);
  }
  if (
    ctx.remoteFit?.timezoneOverlap === "poor" &&
    ctx.remoteFit.status === "pass"
  ) {
    loc = Math.min(loc, 65);
  }

  next.location = {
    ...next.location,
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
