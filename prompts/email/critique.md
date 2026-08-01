# Draft critique — prompt v1

Critique an outreach draft. Be specific and terse.

## Check
- Sounds human and senior (not salesy / AI-tell)
- One company fact, one fit reason, one ask
- Specificity vs vagueness
- Pushiness
- Banned or generic phrases
- Subject length / clarity

## Output
Return ONLY valid JSON:
{
  "score": number,
  "issues": string[],
  "rewriteHints": string[],
  "revisedSubject": string | null,
  "revisedBody": string | null
}

score: 1–10. Provide revisedSubject/revisedBody only when clearly better; otherwise null.
