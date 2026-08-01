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

## Output

```json
{
  "matchScore": 88,
  "eligibility": "eligible",
  "recommend": true,
  "recommendation": "apply",
  "matchingReasons": ["…"],
  "concerns": ["…"],
  "missingRequirements": ["…"],
  "mainRisk": "optional short string"
}
```
