# Client Outreach

Local single-user client discovery and outreach app.

**Build status:** Phases 0–5 code is complete. Open items are validation/ops (daily runs, mailbox DNS, human scoring) — track them on **Admin → Validation readiness**. Phase 5 later (ATS, multi-user, remote) stays deferred.

## Setup

```bash
cp .env.example .env
# Add GOOGLE_API_KEY (research) and ANTHROPIC_API_KEY (drafts)
# Phase 3 mail: GMAIL_USER + GMAIL_APP_PASSWORD
# Prefer macOS Keychain: service=client-outreach, account=<NAME>

npm install
npm run db:migrate
npm run dev
```

App binds to **127.0.0.1:3000** only.

```bash
npm test                 # unit + phase2 quality
npm run worker           # daily pipeline
npm run backup           # SQLite backup + 7 daily / 4 weekly rotation
npm run export-data      # JSON export → data/exports/
npm run retention        # dry-run prune; add -- --apply to delete
npm run eval:writing     # Phase 2 model comparison scorecard
npm run eval:research    # Phase 1 research factuality scorecard
```

## What to do next (ops, not code)

1. Run `npm run worker` on consecutive weekdays (or install launchd plist under `docs/operations/`).
2. Review leads daily; mark accept/reject; generate drafts.
3. Score drafts with `npm run eval:writing` after ~20 accepted leads.
4. Complete mailbox DNS checklist (`docs/operations/mailbox-setup.md`) before live SMTP.
5. Tick Phase 3 ops boxes on Admin when each item is done.

## Phase 2 — Contacts & message quality

On an accepted lead:

1. **Harvest website contacts** (mailto + team page people via public LLM)
2. Use lookup links / **Suggest patterns** (`pattern_unverified` — confirm before send)
3. Generate draft — deterministic quality checks + optional critique
4. After sent: **Generate follow-up 1/2**

## Phase 3 — Gmail automation

Credential strategy: **Gmail app password** (Keychain / `.env` fallback).

1. Draft → edit → **Approve for send**
2. Open **Send queue** → Process send queue (SMTP, max 5/day, weekdays)
3. Sync replies (IMAP)

```bash
npm run mail:send
npm run mail:sync
```

## Privacy

Admin → **Privacy**, or `npm run export-data` / `npm run retention -- --apply`.

Policy notes: `docs/legal/outreach-policy.md`.
