/**
 * Product policy notes for outreach — not legal advice.
 * Recheck national rules before scaling volume.
 */

# Outreach & data policy (MVP)

## Purpose

Client Outreach stores business contact data only to support targeted, low-volume
outreach for senior product-design work. It is a single-user local app.

## Contact collection

- Do not create contact records before lead acceptance (except harvested candidates
  after accept, when the user explicitly harvests).
- Record source URL, collection time, business relevance, and country policy applied.
- Prefer published personal or generic company emails over pattern guesses.
- `pattern_unverified` suggestions require manual confirmation before send approval.
- Never invent deliverable addresses; never SMTP-probe from a residential IP.

## Country policy defaults

| Region | Policy |
|---|---|
| Germany (DE) | `prior_interaction_required` |
| Austria (AT) | `prior_interaction_required` |
| Other EU (unreviewed) | `manual_review_required` |
| `unknown` | treated as `manual_review_required` |

Configure overrides in Settings. The system must not claim GDPR legitimate interest
alone as permission to cold email.

## Sending

- Approval hash gate before SMTP send
- Max 5 new emails/day, weekdays, ≤2 follow-ups
- Immediate suppression on opt-out
- No tracking pixels, no shortened links, no automatic reply sending

## Retention

| Data | Retention |
|---|---|
| Rejected-lead contacts | delete within 30 days (`npm run retention`) |
| Never-contacted personal contacts | delete within 30 days |
| Raw API payloads | clear after 90 days |
| Suppressions | keep minimal fields |
| Sent correspondence | retain while business-relevant |

## Export / delete

Always available via Admin or `npm run export-data` — never blocked by AI budget.
