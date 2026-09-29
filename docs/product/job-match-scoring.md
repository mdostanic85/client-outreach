# Job Match Scoring — Implementation

**Product:** Optra — Jobs mode  
**Status:** Implemented (prompt `@v4` + code-weighted total)  
**Date:** 2026-08-07  
**Related:** [Job discovery plan](job-discovery-implementation-plan.md) · [AI collection flow](ai-job-collection-flow.md) · Outreach pattern in `prompts/research-and-score.md` + `calculateScoreTotal`

---

## Problem

Today `prompts/jobs/match-and-explain.md` asks the model for a single `matchScore` 0–100 plus bands. That works for MVP but:

1. Totals drift — models inflate to fill “Strong” / quota pressure.
2. Weights cannot learn — Learning proposals for scoring cannot wire into a black-box number.
3. UI cannot show *why* 72 vs 88 beyond free-text reasons.
4. Outreach already solved this correctly: **dimensions from LLM → total in code**.

Job match must follow the same principle. Never trust a model-computed total.

---

## Principle

```text
Hard gates decide eligibility (can apply?).
LLM scores dimensions with evidence (how does each facet fit?).
Application code computes matchScore from weights.
Bands + ranking use the code total only.
```

| Layer | Owner | Output |
|---|---|---|
| Hard filter / eligibility | Rules + LLM `eligibility` / `remoteFit` | publish or drop |
| Dimension ratings | LLM | 0–100 per dim + evidence |
| Soft penalties | Code | adjust dim or total |
| `matchScore` | Code | weighted sum, rounded |
| Tier / publish | Code | Strong / Worth a look / skip |

---

## Hard gates (not percentage)

Run before or alongside scoring. Failures never publish to Today, regardless of a high dimension average.

| Gate | Fail when | Source |
|---|---|---|
| Remote / geo | Onsite-only, relocation required, country allowlist excludes candidate (Serbia / remote-EU / worldwide rule) | Rules + `remoteFit.status === fail` |
| Seniority / discipline | Clear wrong band or wrong craft | LLM `eligibility === ineligible` |
| Title exclusions | Hits `excludedTitles` from search profile | Deterministic filter (pre-LLM) |

**Soft (not a gate):** ambiguous TZ / “US preferred” / hybrid UK → penalty on `locationTimezone` (see Soft penalties). Do not drop every unclear Remotive “Europe” listing.

Align with resolved decision #5 in the job discovery plan.

---

## Dimensions

LLM returns each dimension as `{ score: 0–100, evidence: string }` (evidence ≤ ~140 chars, prefer posting quotes).

| Key | What it measures | Default weight |
|---|---|---|
| `skills` | Core stack / craft tools vs posting must-haves | 25 |
| `seniority` | Title + years band vs profile level | 15 |
| `experience` | Relevant domain / product surface depth | 15 |
| `locationTimezone` | Remote policy + geo + TZ overlap | 15 |
| `employmentType` | Full-time / contract / fractional fit to prefs | 8 |
| `compensation` | Pay band vs expectations (unknown → null, excluded from sum) | 7 |
| `industry` | Industry / company type fit | 5 |
| `portfolioFit` | Project evidence maps to role asks | 5 |
| `language` | Language requirements vs profile | 5 |

Weights sum to **100**. Unknown optional dims (`compensation` when posting has no pay signal) are **renormalized out** of the sum so they do not silently drag the score to mid-range.

Map from earlier J3 names:

| J3 name | This spec |
|---|---|
| `experience` | `experience` |
| `designSystems` / leadership | fold into `skills` + `seniority` (or split later if Learning needs it) |
| `locationTimezone` | `locationTimezone` |
| `employmentType` | `employmentType` |
| `language` | `language` |
| `compensation` | `compensation` |
| `portfolioFit` | `portfolioFit` |
| `industry` | `industry` |

---

## Total calculation (code only)

Mirror outreach `calculateScoreTotal`:

```ts
// Pseudocode — ship in src/modules/matching/score.ts
function calculateMatchScore(
  dims: Record<DimKey, { score: number } | null>,
  weights: Record<DimKey, number>, // from defaults or settings_job_scoring
): number {
  let num = 0;
  let den = 0;
  for (const key of DIM_KEYS) {
    const d = dims[key];
    const w = weights[key];
    if (d == null || !Number.isFinite(d.score) || w <= 0) continue;
    num += clamp(d.score, 0, 100) * w;
    den += w;
  }
  if (den === 0) return 0;
  return Math.round((num / den) * 10) / 10;
}
```

Rules:

- Ignore any `matchScore` the model still returns (compat field only during migration).
- Persist both `dimensions` and computed `matchScore` in `scoreJson`.
- Prompt version bump when schema changes (e.g. `match-and-explain@v4`).

### Soft penalties (after weighted sum, or on dim)

| Condition | Effect |
|---|---|
| `remoteFit.status === unclear` and `searchHints.remoteRequired` | Cap `locationTimezone` at 55, or −8 on total (pick one; prefer dim cap) |
| `timezoneOverlap === poor` but still `pass` | Cap `locationTimezone` at 65 |
| `eligibility === borderline` | Cap final total at 69 (cannot be Strong) |

Hard `remoteFit.fail` / `ineligible` → do not publish; total optional for analytics only.

---

## Bands (unchanged UX)

Reuse `src/modules/matching/tiers.ts`:

| Band | Score | UI |
|---|---|---|
| Strong | ≥ 70 | Primary Today tab |
| Worth a look | 55–69 | Secondary tab, caveats |
| Drop | &lt; 55 | Not published |

Also require `recommend !== skip` / `eligibility !== ineligible` / `remoteFit` not `fail` when remote required.

Recommendation mapping (code, not model):

- `apply` — eligible, score ≥ 70, remote pass (or remote not required)
- `consider` — score 55–69 or borderline / remote unclear
- `skip` — else

---

## Prompt + schema changes

### Prompt (`prompts/jobs/match-and-explain.md`)

- Remove band instructions that tell the model to invent an overall 80–100 / 70–79 / …
- Instruct: score **each dimension** 0–100 from posting evidence; do **not** compute a total.
- Keep `eligibility`, `recommendation` optional (code may overwrite), `matchingReasons`, `concerns`, `missingRequirements`, `mainRisk`, `remoteFit`.
- `matchingReasons`: still `"Label: evidence"` — prefer strongest dims (≥ 1 reason per top dim).

### Zod (`JobMatchResultSchema`)

```ts
const DimSchema = z.object({
  score: z.number().min(0).max(100),
  evidence: z.string().max(200).optional(),
});

z.object({
  // deprecated during migration — strip before persist
  matchScore: z.number().min(0).max(100).optional(),
  dimensions: z.object({
    skills: DimSchema,
    seniority: DimSchema,
    experience: DimSchema,
    locationTimezone: DimSchema,
    employmentType: DimSchema,
    compensation: DimSchema.nullable(),
    industry: DimSchema,
    portfolioFit: DimSchema,
    language: DimSchema,
  }),
  eligibility: z.enum(["eligible", "borderline", "ineligible"]),
  recommend: z.boolean().optional(),
  recommendation: z.enum(["apply", "consider", "skip"]).optional(),
  matchingReasons: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  missingRequirements: z.array(z.string()).default([]),
  mainRisk: z.string().optional(),
  remoteFit: RemoteFitSchema.optional(),
});
```

After parse: `matchScore = calculateMatchScore(dimensions, weights)` → write into result + `scoreJson`.

---

## Weights storage

Do **not** reuse outreach `settings_scoring` (different dimensions, different question).

| Option | Choice |
|---|---|
| Table | `settings_job_scoring` (`weights_json`, `updated_at`) **or** extend settings with `job_match_weights_json` |
| Defaults | Constants in `src/modules/matching/score.ts` (`JOB_MATCH_WEIGHTS`) |
| Learning | New proposal kind `job_scoring_weights` — propose / Accept / Reject (same UX as outreach scoring) |
| Wire-up | `calculateMatchScore` **must** read active weights (avoid the outreach bug where proposals write DB but total ignores them) |

Matching sources (`matching-sources`) still control **profile payload**, not dimension weights. Turning off portfolio → thinner `portfolioFit` evidence; weight stays unless user changes weights.

---

## Pipeline touchpoints

```text
filter survivors
      ↓
llm_job_evaluate_batch  → dimensions + eligibility + remoteFit
      ↓
calculateMatchScore + soft penalties + recommendation normalize
      ↓
persist job_matches (matchScore, scoreJson with dimensions)
      ↓
rank (matchScore, eligibility, freshness, …)
      ↓
publish ≤20 (Strong first; Worth a look capped)
```

Files to touch:

| Area | Path |
|---|---|
| Prompt | `prompts/jobs/match-and-explain.md` |
| Score math | `src/modules/matching/score.ts` (new) |
| Evaluate | `src/modules/matching/evaluate.ts` |
| Tiers | `src/modules/matching/tiers.ts` (keep thresholds; maybe export band helpers) |
| UI badge tooltip | `src/components/score-badge.tsx` — mention top dims |
| Match insights | `src/components/match-insights.tsx` — optional dim bars / check-X |
| Tests | unit tests for `calculateMatchScore`, renormalize, soft caps, borderline cap |
| Learning | proposal kind + apply path that updates job weights |

---

## UI (minimal)

MVP of this change does **not** require a full radar chart.

1. **Score badge** — still shows code `matchScore`; tooltip: “Weighted fit across skills, seniority, location, and preferences.”
2. **Insights** — keep `matchingReasons` / concerns; optionally show top 3 dims as compact rows (score + evidence) when `dimensions` present in `scoreJson`.
3. **Fallback** — old rows without `dimensions`: show score + reasons only; no fake dim bars.

Mobbin reference already noted in UX audit: Workable-style check/X dimensions vs paragraphs.

---

## Migration

1. Ship `@v4` prompt + code total; dual-read: if `dimensions` present → recompute; else keep stored `matchScore`.
2. Re-score is **not** required for old daily lists; next Find jobs run uses new path.
3. Remove accepting model `matchScore` after one release once evaluate always writes dimensions.

---

## Build checklist

### Core

- [x] `src/modules/matching/score.ts` — weights defaults, `calculateMatchScore`, soft penalties
- [x] Update `JobMatchResultSchema` + `normalizeRecommendation` to use code total
- [x] Rewrite `prompts/jobs/match-and-explain.md` (no overall band coaching)
- [x] Bump `JOB_MATCH_PROMPT_VERSION`
- [x] Persist `dimensions` inside `scoreJson`; `matchScore` column / field = code total
- [x] Unit tests: weights, null compensation renormalize, unclear remote cap, borderline ≤69

### Weights + learning

- [x] Persist job-match weights (new settings row or column)
- [x] `job_scoring_weights` proposal kind; Accept writes weights used by scorer
- [x] Verify scorer reads DB weights (integration smoke)

### UI (optional same PR / follow-up)

- [x] Score badge copy update
- [x] Dim breakdown in match insights when available
- [x] Graceful fallback for pre-v4 `scoreJson`

### Out of scope

- Auto-apply of weight changes without Accept
- Reusing outreach `settings_scoring` / `needNow` for jobs
- Padding daily list when few jobs pass 55+

---

## Definition of done

- Every new `job_matches` row has `dimensions` + a `matchScore` computed only in application code.
- Inflating a single free-form total in the prompt cannot raise published rank.
- Soft remote/TZ ambiguity lowers `locationTimezone` (or total) without hard-dropping unclear EU remote listings.
- `eligibility === ineligible` / remote fail never appear in Strong or Worth a look.
- Learning can propose job weight tweaks that actually change the next run’s totals after Accept.

---

## Document control

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-08-07 | Initial spec: hard gates + weighted dims + code total |
| 1.1 | 2026-08-07 | Implemented: score.ts, evaluate@v4, settings_job_scoring, UI dims |
