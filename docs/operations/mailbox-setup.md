# Dedicated mailbox setup (Phase 3 ops)

Complete these before live automated sending. Track status in **Admin → Validation readiness**.

## Connect mailbox (simplest path)

Open **Admin → Connect mailbox**.

### Gmail

1. One-time: create a Google Cloud **OAuth client** (Web application).
2. Authorized redirect URI (match the port you run):
   `http://127.0.0.1:3003/api/mail/oauth/google/callback`
   (or `:3000` if you use the default `pnpm dev` port)
3. Paste Client ID + Secret into the Gmail card (or Keychain / `.env`).
4. Click **Connect Gmail** → sign in with Google → done.

### Other email

1. Click **Connect other email**.
2. Enter email, password, **SMTP** (outgoing), **IMAP** (incoming).
3. Save. IMAP is required so Optra can track replies (POP is not supported).

Credentials stay in Keychain / `.env` — never SQLite.

## Ops checklist

1. **Product validated** — Phase 1/2 quality gates look good.
2. **Dedicated outreach mailbox** — separate from personal inbox when possible.
3. **SPF / DKIM / DMARC** — for your sending domain.
4. **Manual practice** — send a few messages by hand first.

## App commands

```bash
npm run mail:send
npm run mail:sync
```

UI: Approve draft → **/queue** → Process / Sync.

## Do not yet

- Raise daily cap above 5 until ≥50 valid delivered + healthy bounce/reply rates
- Auto-send to `pattern_unverified`
