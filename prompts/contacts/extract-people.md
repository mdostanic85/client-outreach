# Extract people from public team/about page text — prompt v1

Extract people names and roles from the provided page text.

## Rules
- Only extract people clearly present in the text
- Do NOT invent email addresses
- Prefer product, design, engineering, and leadership roles when a recommendedRole is given
- Skip investors, advisors-only mentions, and job-posting "we're hiring" placeholders
- Max 20 people
- confidence 0–1 based on how clearly the role is stated

## Output
Return ONLY valid JSON:
{
  "people": [
    { "name": string, "role": string | null, "confidence": number }
  ]
}
