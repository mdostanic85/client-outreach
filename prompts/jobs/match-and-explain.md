# Job match and explain

Compare one job posting to the candidate's approved professional profile. The candidate can be in any occupation — nurse, truck driver, electrician, chef, accountant, teacher, developer, designer. `searchHints.occupationFamily` says which; judge the posting the way an employer in that field would.

Return structured JSON only. Be honest — do not inflate dimension scores to fill a quota.

**Do not compute an overall match percentage.** The application calculates the total from your dimension scores and weights.

## Eligibility

- `eligible` — can apply from where they are; level, core skills and required licences fit
- `borderline` — ambiguous location/commute or stretch level/skills
- `ineligible` — hard location lock, wrong level band, wrong occupation, clear remote ban when they need remote, or a mandatory licence / certificate they don't have

## Mandatory requirements

`mandatoryMissing`: list licences, certificates, permits or registrations the posting says are **required** (not "an advantage") that the profile does not show — e.g. "Driving licence CE", "ADR certificate", "Nursing licence", "Sanitary booklet", "Work permit for Germany". Use `licenses`, `certifications` and `workAuthorization` in the profile. Empty array when nothing mandatory is missing or when the posting lists nothing mandatory. Any item here makes the posting ineligible.

## Recommendation (optional)

You may omit `recommendation` / `recommend` — the application derives them from eligibility, remote fit, and the code-computed total.

If you include them: `apply` | `consider` | `skip`.

## Dimension scoring (required)

Score each dimension 0–100 from posting evidence vs the profile. Prefer quotes / concrete signals over guesses. Score only dimensions that apply to this job; return `null` for the rest.

Each dimension: `{ "score": number, "evidence": "short string ≤140 chars" }` or `null`.

| Key | Measures | `null` when |
|---|---|---|
| `skills` | Skills, tools and equipment vs what the posting asks | never |
| `experience` | Years and relevant experience | never |
| `seniority` | Level band (junior / senior / lead) vs profile | the field has no level ladder (most trades, drivers, care work) |
| `requirements` | Licences, certificates, education, permits the posting asks for vs profile | the posting asks for none |
| `location` | Commute distance / city, or remote + geo + time zone for remote roles | never |
| `schedule` | Shifts, nights, weekends, full-time / part-time / seasonal / contract vs preferences | the posting says nothing about it |
| `compensation` | Pay vs expectations (monthly net RSD is common in Serbia) | the posting has no pay signal |
| `evidenceFit` | Portfolio, projects, GitHub, work samples vs what the role asks | the field doesn't use them (drivers, nurses, cashiers…) |
| `industry` | Industry / company type fit | not a factor |
| `language` | Language requirements vs profile | no language requirement |

Do **not** invent pay, remote policy or requirements. Weak evidence → lower score or `null`.

## Remote fit (required)

Always return `remoteFit`. This is a hard decision surface only when `searchHints.remoteRequired` is true; for on-site searches keep it short (policy + summary).

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

The profile's `relevantProjects` come from their CV, portfolio, certificates and GitHub. When one is relevant to this posting, at least one matching reason must name it, e.g. `"Proof: OriginChains — B2B climate platform UX"` or `"Proof: 6 years international CE routes at Milšped"`. Never invent evidence. Only mention a missing portfolio for fields that use portfolios.

## Their past decisions

`candidateFeedback` lists roles they recently skipped (with their reason, when given) and roles they saved or applied to. Treat these as preferences:

- A posting that repeats a skip reason (same kind of company, domain, seniority, location or contract) scores lower and names that reason in `concerns`.
- A posting that resembles saved or applied roles may score higher, but only when the posting itself supports the fit.
- The profile and search hints still win over feedback when they conflict.

## Matching reasons format

Each `matchingReasons` item should be `"Label: short evidence"` (max ~140 chars), e.g.:

- `"Stack: React, TypeScript, Cursor, Claude"`
- `"Licence: CE + ADR, as required"`
- `"Ward: 5 years in intensive care, posting is ICU"`

Prefer 3–5 strong reasons tied to your highest dimension scores. Skip fluff.

## Output

```json
{
  "dimensions": {
    "skills": { "score": 80, "evidence": "Tautliner and reefer experience; posting is reefer" },
    "experience": { "score": 85, "evidence": "6 years international routes; posting asks 2+" },
    "seniority": null,
    "requirements": { "score": 95, "evidence": "CE, ADR and tachograph card all required and held" },
    "location": { "score": 90, "evidence": "Depot in Novi Sad, candidate lives there" },
    "schedule": { "score": 60, "evidence": "2-week tours; candidate prefers weekends home" },
    "compensation": { "score": 75, "evidence": "1,800 EUR/month net vs 150,000 RSD minimum" },
    "evidenceFit": null,
    "industry": null,
    "language": { "score": 70, "evidence": "Basic German requested; candidate has basic" }
  },
  "eligibility": "eligible",
  "mandatoryMissing": [],
  "matchingReasons": ["Licence: CE + ADR, as required", "Routes: 6 years EU international"],
  "concerns": ["2-week tours vs weekends at home"],
  "missingRequirements": [],
  "mainRisk": "optional short string",
  "remoteFit": {
    "status": "fail",
    "policy": "onsite",
    "geoOk": true,
    "timezoneOverlap": "unknown",
    "summary": "On-site driving job; candidate searches on-site.",
    "evidence": ["Depot: Novi Sad"]
  }
}
```

For a remote tech role the same shape applies, e.g. `"seniority": { "score": 82, "evidence": "Senior band matches" }`, `"evidenceFit": { "score": 80, "evidence": "Design system case studies" }`, `"requirements": null`.
