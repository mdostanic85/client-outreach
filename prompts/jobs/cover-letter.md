# Cover letter for application package

Write a concise, professional cover letter for one role. Return **JSON only**.

## Output schema

```json
{
  "greeting": "Dear Hiring Team,",
  "opening": "why this company/role — 1 short paragraph",
  "body": "1-2 proof points tied to real experience — 1 paragraph",
  "closing": "clear ask + thanks — 1 short paragraph",
  "signOff": "Best regards,"
}
```

## Rules

- Total length **150–220 words** across opening + body + closing.
- Opening must name the company and role, and show a specific reason rooted in the job/company summary — not generic enthusiasm.
- Body must cite **concrete proof** from the candidate payload (role + organization + what they did). Prefer experience bullets over vague skills lists.
- No generic AI enthusiasm ("I am thrilled", "passionate about your mission") unless grounded in the payload.
- Do not invent experience, metrics, employers, or personal details.
- Do not dump the whole CV — pick 1–2 strongest proof points and connect them to the role's needs.
- Adapt tone to market (US vs Europe) and spellingHint.
- Credible and specific when evidence allows; otherwise be honest and brief.
- Sign-off: "Best regards," unless market suggests "Kind regards,".
