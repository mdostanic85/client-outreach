import { z } from "zod";

export const EvidenceItemSchema = z.object({
  id: z.string(),
  url: z.string(),
  pageTitle: z.string().optional(),
  retrievedAt: z.string(),
  excerpt: z.string(),
});

export const ResearchAndScoreSchema = z.object({
  companySummary: z.string(),
  productSurface: z.array(z.string()),
  currentNeedSignals: z.array(
    z.object({
      claim: z.string(),
      evidenceIds: z.array(z.string()),
      strength: z.enum(["strong", "medium", "weak"]),
    }),
  ),
  fitReasons: z.array(
    z.object({
      reason: z.string(),
      evidenceIds: z.array(z.string()),
    }),
  ),
  risksAndUnknowns: z.array(z.string()),
  recommendedContactRole: z.string(),
  recommendedAngle: z.enum([
    "hiring_support",
    "post_funding_scale",
    "product_redesign",
    "design_systems",
    "fractional_leadership",
    "insufficient_evidence",
  ]),
  score: z.object({
    needNow: z.number().min(0).max(100),
    fit: z.number().min(0).max(100),
    abilityToPay: z.number().min(0).max(100),
    accessibility: z.number().min(0).max(100),
    engagementMatch: z.number().min(0).max(100),
  }),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type ResearchAndScore = z.infer<typeof ResearchAndScoreSchema>;

/** Final total is calculated in code — never trust model total. */
export function calculateScoreTotal(score: ResearchAndScore["score"]): number {
  const total =
    score.needNow * 0.3 +
    score.fit * 0.3 +
    score.abilityToPay * 0.15 +
    score.accessibility * 0.15 +
    score.engagementMatch * 0.1;
  return Math.round(total * 10) / 10;
}

export const SCORE_WEIGHTS = {
  needNow: 30,
  fit: 30,
  abilityToPay: 15,
  accessibility: 15,
  engagementMatch: 10,
} as const;
