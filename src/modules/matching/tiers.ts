/** Strong fits — primary Today list. */
export const STRONG_MATCH_MIN = 70;
/** Secondary “Worth a look” band — show with caveats, never pad below this. */
export const WORTH_A_LOOK_MIN = 55;
/** Cap for secondary band published per run. */
export const WORTH_A_LOOK_LIMIT = 12;

export type MatchTier = "strong" | "worth_a_look";

export function matchTierForScore(
  score: number | null | undefined,
): MatchTier | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= STRONG_MATCH_MIN) return "strong";
  if (score >= WORTH_A_LOOK_MIN) return "worth_a_look";
  return null;
}
