# Client Outreach

Local single-user client discovery and outreach app.

**Owner:** [Miloš Dostanić](https://dostanic.net) — proprietary. See [`LICENSE`](./LICENSE) and [`OWNERSHIP.md`](./OWNERSHIP.md). All rights reserved.

**Build status:** Phases 0–5 code is complete. Open items are validation/ops (daily runs, mailbox DNS, human scoring) — track them on **Admin → Validation readiness**. Direct public ATS collection is available in the staged Job Finder V2 update; multi-user isolation and remote MCP remain deferred.

## Architecture

Code layout, domain boundaries, the Server Action convention and where each
step of job search and client outreach lives: [`docs/architecture.md`](docs/architecture.md).

## Setup

```bash
cp .env.example .env
# Add GOOGLE_API_KEY (research) and ANTHROPIC_API_KEY (drafts)
# Phase 3 mail: Admin → Connect mailbox (Gmail OAuth or other SMTP/IMAP)
# Prefer macOS Keychain: service=client-outreach, account=<NAME>

npm install
npm run db:migrate
npm run dev
```

App binds to **127.0.0.1:3000** only.

```bash
npm test                 # full unit suite (no network, no database)
npm run worker           # daily pipeline
npm run backup           # See backup script and current Neon deployment setup
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

## Phase 3 — Mailbox automation

Open **Admin → Connect mailbox**:

- **Gmail** — sign in with Google (OAuth)
- **Other email** — username, password, SMTP + IMAP hosts

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

## Job Finder V2

Plan and source evaluation: [V2 plan](docs/product/job-finder-v2.md). Implementation, validation, job-only worker and read-only MCP: [V2 operations](docs/operations/job-finder-v2.md). The current database is Neon PostgreSQL (`DATABASE_URL`), not SQLite.
