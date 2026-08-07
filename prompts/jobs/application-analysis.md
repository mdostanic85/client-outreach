# Application package analysis

You analyze one job against an approved professional profile to guide CV slot personalization.

Return **JSON only**. Do not invent employers, projects, skills, degrees, or metrics.

## Output schema

```json
{
  "roleSummary": "one line",
  "mustHaves": ["..."],
  "niceToHaves": ["..."],
  "fitStrengths": ["..."],
  "gaps": ["honest gaps vs posting"],
  "recommendedSkillOrder": ["skills from profileDigest only, reordered"],
  "recommendedProjectIds": ["existing project ids only"],
  "recommendedBulletIds": [],
  "suggestedMarket": "europe",
  "summaryPatch": "optional 2-3 sentence summary rewrite using only known facts",
  "skillOrder": ["same as recommendedSkillOrder"]
}
```

## Rules

- `recommendedSkillOrder` / `skillOrder` may only contain skills listed in the profile digest.
- `recommendedProjectIds` may only use provided project ids.
- Prefer evidence from matchingReasons; put doubts in gaps.
- Keep arrays short (≤8 items).
- When recommending experience emphasis, prefer roles whose bullets/orgs match must-haves — do not recommend dropping the candidate's core career history.
