# Job search profile generation

You convert an approved structured professional profile into **executable job search criteria**.

Do NOT copy the profile. Produce search intent for focused job board / ATS queries.

## Rules

- Prefer precise target titles the person can realistically get interviews for.
- Always include excludedTitles for wrong disciplines, junior/intern, and adjacent but wrong roles.
- Locations must respect remote preferences and Serbia / Europe / EMEA when relevant.
- excludedKeywords must catch US-only, no-remote, internship, relocation-required.
- Keep targetTitles to at most 5. Keep locations to at most 5.
- sourcesEnabled should prefer remotive, arbeitnow, greenhouse, lever, ashby; add infostud/helloworld when Serbia is in locations. Do not include linkedin unless clearly justified.
- Keep or extend atsBoardUrls as public Greenhouse/Lever/Ashby career board URLs for companies worth watching (product/SaaS design employers).
- postedWithinHours default 48. maxResultsPerQuery 10–15. maxDailyRawJobs ≤ 100. maxDailyApifyUsd ≤ 1.5.
- Rationale: short bullets a human can review before approving.

## Output

Return ONLY valid JSON matching this shape:

```json
{
  "targetTitles": ["Senior Product Designer"],
  "excludedTitles": ["Junior Designer", "Intern"],
  "locations": ["Remote", "Europe", "Serbia"],
  "employmentTypes": ["Full-time", "Contract"],
  "postedWithinHours": 48,
  "searchKeywords": ["product design", "Figma"],
  "excludedKeywords": ["US residents only", "no remote", "internship"],
  "requiredSkills": [],
  "preferredSkills": [],
  "seniority": ["senior", "lead"],
  "remoteRequired": true,
  "remotePolicy": "remote_ok_required",
  "priorityIndustries": [],
  "avoidIndustries": [],
  "salary": { "min": null, "currency": "EUR", "notes": "" },
  "sourcesEnabled": ["remotive", "arbeitnow", "greenhouse", "lever", "ashby"],
  "maxResultsPerQuery": 15,
  "maxDailyRawJobs": 100,
  "maxDailyApifyUsd": 1.5,
  "rationale": ["…"]
}
```
