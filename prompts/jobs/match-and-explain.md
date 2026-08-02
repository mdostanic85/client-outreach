# Job match and explain

Compare one job posting to the candidate's approved professional profile.

Return structured JSON only. Be honest — do not inflate scores to fill a quota.

## Eligibility

- `eligible` — can apply from their location/remote setup; seniority and core skills fit
- `borderline` — ambiguous location/TZ or stretch seniority/skills
- `ineligible` — hard location lock, wrong seniority band, wrong discipline, or clear remote ban

## Recommendation

- `apply` — strong match, recommend
- `consider` — worth a look with caveats
- `skip` — do not recommend

## Scoring

`matchScore` 0–100. Prefer evidence from the posting vs inventing fit.

Use these bands consistently (do not inflate to fill a quota):

- **80–100** — clear apply: title, seniority, remote/location, and core skills align
- **70–79** — solid fit with minor caveats (still recommend)
- **55–69** — worth a look: stretch seniority/skills or ambiguous TZ/location, but not a hard mismatch
- **below 55** — skip unless evidence is unusually strong

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

## Matching reasons format

Each `matchingReasons` item should be `"Label: short evidence"` (max ~140 chars), e.g.:

- `"Stack: React, TypeScript, Cursor, Claude"`
- `"Domain: B2B SaaS and data-heavy UX"`

Prefer 3–5 strong reasons. Skip fluff.

## Output

```json
{
  "matchScore": 88,
  "eligibility": "eligible",
  "recommend": true,
  "recommendation": "apply",
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
