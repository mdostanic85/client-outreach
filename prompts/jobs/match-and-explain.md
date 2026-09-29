# Job match and explain

Compare one job posting to the candidate's approved professional profile.

Return structured JSON only. Be honest — do not inflate dimension scores to fill a quota.

**Do not compute an overall match percentage.** The application calculates the total from your dimension scores and weights.

## Eligibility

- `eligible` — can apply from their location/remote setup; seniority and core skills fit
- `borderline` — ambiguous location/TZ or stretch seniority/skills
- `ineligible` — hard location lock, wrong seniority band, wrong discipline, or clear remote ban

## Recommendation (optional)

You may omit `recommendation` / `recommend` — the application derives them from eligibility, remote fit, and the code-computed total.

If you include them: `apply` | `consider` | `skip`.

## Dimension scoring (required)

Score **each** dimension 0–100 from posting evidence vs the profile. Prefer quotes / concrete signals over guesses.

Each dimension: `{ "score": number, "evidence": "short string ≤140 chars" }`.

| Key | Measures |
|---|---|
| `skills` | Core stack / craft tools vs posting must-haves |
| `seniority` | Title + years band vs profile level |
| `experience` | Relevant domain / product surface depth |
| `locationTimezone` | Remote policy + geo + TZ overlap |
| `employmentType` | Full-time / contract / fractional vs prefs |
| `compensation` | Pay band vs expectations — use `null` when posting has no pay signal |
| `industry` | Industry / company type fit |
| `portfolioFit` | Project evidence maps to role asks |
| `language` | Language requirements vs profile |

Do **not** invent pay or remote policy. Weak evidence → lower score or `compensation: null`.

## Remote fit (required)

Always return `remoteFit`. This is a hard decision surface when `searchHints.remoteRequired` is true.

- `status`
  - `pass` — posting explicitly allows remote (or remote-first) **and** candidate geo/TZ looks workable
  - `unclear` — city/HQ listed without clear remote policy, ambiguous worldwide/region lock, or thin TZ overlap
  - `fail` — onsite-only, hard geo lock that excludes the candidate, or unusable timezone overlap
- `policy` — `remote` | `hybrid` | `onsite` | `unspecified` (from the posting, not guesses)
- `geoOk` — `true` / `false` / `null` when unknown
- `timezoneOverlap` — `full` | `partial` | `poor` | `unknown`
- `summary` — one short line the UI can show as a verdict
- `evidence` — 1–3 short strings (prefer quotes or concrete posting signals)

Do **not** bury remote/TZ only inside `concerns`. Put the verdict in `remoteFit`, and keep related caveats in `concerns` too if useful.

## Evidence from their work

The profile's `relevantProjects` come from their CV, portfolio case studies and GitHub. When a project is relevant to this posting, at least one matching reason must name it, e.g. `"Proof: OriginChains — B2B climate platform UX, same B2B SaaS space"`. Never invent a project; if none is relevant, say so in `concerns` (e.g. "No portfolio work in fintech").

## Their past decisions

`candidateFeedback` lists roles they recently skipped (with their reason, when given) and roles they saved or applied to. Treat these as preferences:

- A posting that repeats a skip reason (same kind of company, domain, seniority, location or contract) scores lower and names that reason in `concerns`.
- A posting that resembles saved or applied roles may score higher, but only when the posting itself supports the fit.
- The profile and search hints still win over feedback when they conflict.

## Matching reasons format

Each `matchingReasons` item should be `"Label: short evidence"` (max ~140 chars), e.g.:

- `"Stack: React, TypeScript, Cursor, Claude"`
- `"Domain: B2B SaaS and data-heavy UX"`

Prefer 3–5 strong reasons tied to your highest dimension scores. Skip fluff.

## Output

```json
{
  "dimensions": {
    "skills": { "score": 88, "evidence": "React, TypeScript, design systems required" },
    "seniority": { "score": 82, "evidence": "Senior / Staff band matches profile" },
    "experience": { "score": 75, "evidence": "B2B SaaS product design" },
    "locationTimezone": { "score": 60, "evidence": "Remote unclear; Denver HQ; CET↔MT thin" },
    "employmentType": { "score": 90, "evidence": "Full-time remote OK" },
    "compensation": null,
    "industry": { "score": 70, "evidence": "Developer tools adjacency" },
    "portfolioFit": { "score": 80, "evidence": "Design system case studies map to asks" },
    "language": { "score": 95, "evidence": "English required" }
  },
  "eligibility": "eligible",
  "matchingReasons": ["Stack: React, TypeScript", "Title: Senior Product Designer"],
  "concerns": ["…"],
  "missingRequirements": ["…"],
  "mainRisk": "optional short string",
  "remoteFit": {
    "status": "unclear",
    "policy": "unspecified",
    "geoOk": null,
    "timezoneOverlap": "partial",
    "summary": "Denver HQ listed; remote not explicit; CET↔MT overlap is thin.",
    "evidence": ["Location: Denver, CO", "No remote-first / worldwide language"]
  }
}
```
