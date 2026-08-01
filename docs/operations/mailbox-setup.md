# Dedicated mailbox setup (Phase 3 ops)

Complete these before live automated sending. Track status in **Admin → Validation readiness**.

## Checklist

1. **Product validated** — Phase 1/2 quality gates look good (lead quality, research, drafts).
2. **Dedicated outreach mailbox** — separate from personal Gmail.
3. **SPF** — sending domain publishes SPF that includes Google (or your SMTP provider).
4. **DKIM** — Gmail/Google Workspace DKIM enabled and verifying.
5. **DMARC** — publish a DMARC record; start with `p=none` while monitoring.
6. **Manual practice** — send a few messages by hand from that mailbox first.

## Credentials (local app)

Prefer Keychain:

```bash
security add-generic-password -s client-outreach -a GMAIL_USER -w 'outreach@yourdomain.com'
security add-generic-password -s client-outreach -a GMAIL_APP_PASSWORD -w 'xxxx-xxxx-xxxx-xxxx'
```

Fallback: `.env` `GMAIL_USER` + `GMAIL_APP_PASSWORD` (never commit).

## App commands

```bash
npm run mail:send
npm run mail:sync
```

UI: Approve draft → **/queue** → Process / Sync.

## Do not yet

- Separate outreach subdomain (reputation trade-offs — later)
- Raise daily cap above 5 until ≥50 valid delivered + healthy bounce/reply rates
- Auto-send to `pattern_unverified`
