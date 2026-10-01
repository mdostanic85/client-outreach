# Architecture

How the code is organised and where each responsibility lives. Product
behaviour is described under `docs/product/`; operations under
`docs/operations/`.

## Layers

```
src/app/**            Routes, layouts, Route Handlers. Read data with domain
                      queries, render components. No database access here.
src/components/**     UI. Client components call domain Server Actions;
                      they never import `@/db`.
src/modules/<domain>/ Domain logic, queries and Server Actions.
src/lib/**            Cross-cutting infrastructure (AI providers, budgets,
                      logging, secrets, retrieval, the Server Action boundary).
src/db/**             Drizzle schema, Neon client, additive migrations.
scripts/**            CLI entry points (workers, mail, MCP, privacy, backup).
```

Dependencies point down only: `app` → `components` → `modules` → `lib` / `db`.
Modules never import from `components` or `app`.

## Server Actions

Each domain owns its actions in `src/modules/<domain>/actions.ts` (a
`"use server"` file). Every action goes through `runAction` from
`src/lib/server-action.ts`:

```ts
export async function rejectJobAction(jobId: string, reason: string) {
  return runAction("jobs.reject", "user", async () => {
    await rejectJob(jobId, reason);   // mutation first, awaited
    revalidatePath("/");              // then revalidation
    revalidatePath("/interested");
  });
}
```

`runAction` prepares the database and checks the caller:

- `"user"`: any signed-in account. Domain queries scope rows with `owned()`.
- `"owner"`: the workspace owner only. This covers client outreach, the
  shared mailbox, API keys, admin, privacy tools and outreach settings.

It returns `ActionResult<T>` (`{ ok: true, data }` or `{ ok: false, error }`),
logs failures, and rethrows Next.js `redirect`/`notFound`, so a signed-out
caller is sent to `/welcome` instead of seeing "NEXT_REDIRECT".

`tests/action-access.test.ts` pins which actions are owner-only. Moving an
action between `user` and `owner` is a security decision; update that list on
purpose.

Route Handlers (`src/app/api/**`) are not Server Actions. They check the
caller with `getRequestUser()` from `modules/auth/page-guards.ts` and answer
with their own status codes.

On the client, `useActionRunner()` (`src/components/use-action-runner.ts`)
runs an action in a transition, shows its error or success message and
refreshes the route.

`pnpm lint` includes the type-aware `no-floating-promises` rule. A mutation
or check that is not awaited fails lint.

## Domains

| Module | Owns |
|---|---|
| `auth` | Better Auth setup, session, `currentUserId` / `owned` / `requireOwner`, page and route guards |
| `onboarding` | Survey answers, onboarding flow order (`flow.ts`), completion |
| `profile` | Profile sources (ingest), extraction, versioned structured profile, facts, diff review, CV review, market fit, form mapping |
| `search-profile` | Job search criteria: generation, drafts, approval, versions, form mapping |
| `occupations` | Occupation catalog, families, source planning per family |
| `collectors` | Public job-board adapters and query planning (see below) |
| `jobs` | Job pipeline, filters, persistence, triage decisions, Today/Saved queries |
| `matching` | AI evaluation and cache, scores, tiers, remote fit, learned weights |
| `applications` | Application packages: tailored CV, letter, email, grounding, sending |
| `learning` | Outcomes, insights, cohorts, proposals (never auto-applied), gates |
| `companies` | Company identity (domain, normalised name), company search progress |
| `discovery` | Client-outreach company discovery: hiring signals → companies and leads |
| `research` | Company research briefs (retrieval and scoring) |
| `leads` | Lead lifecycle and transitions, lead queries |
| `contacts` | Contact harvest, patterns, MX check, manual contacts, confidence |
| `outreach` | Outreach drafts and quality checks |
| `mail` | Approvals, send queue, IMAP sync, follow-ups, suppression, mailbox credentials |
| `privacy` | Export, delete, retention |
| `settings` | Per-account settings row (`updateUserSettings`), Today mode, outreach settings |
| `ops` | Admin readiness checklist, secrets and daily worker actions |
| `tracking` | The daily worker pipeline (companies and jobs) |
| `search-experience` | Search stages and the NDJSON stream contract for Find jobs / Find companies |
| `mcp` | Read-only MCP job tools |

## Job search: where each step lives

1. **Plan queries**: `collectors/run.ts` turns the approved search profile and
   occupation family into per-source queries.
2. **Collect and normalise**: each source adapter in `collectors/*.ts` (direct
   ATS, Remotive, Arbeitnow, LinkedIn guest, HelloWorld, Infostud, Joberty,
   Poslovi, NSZ, Apify fallback) returns `RawCollectedJob` (`collectors/types.ts`).
   Run history goes to `collector_runs`.
3. **Filter**: `jobs/filters.ts` (`filterRawJobs`) applies hard filters:
   title, excluded titles and keywords, age, location, remote requirement,
   employment type, seniority, avoided industries and duplicates.
4. **Persist**: `jobs/persist.ts` stores jobs with identity from
   `collectors/identity.ts` (source + external ID, or the canonical URL).
5. **Match and score**: `matching/evaluate.ts` (AI evaluation with a cache
   keyed on content, profile, criteria, model and prompt) and `matching/score.ts`.
6. **Publish**: `matching/evaluate.ts#publishDailyJobList`.
7. **Read for the UI**: `jobs/queries.ts` (Today, Saved, detail, search status).
8. **Decide**: `jobs/triage.ts` (save, decide later, not interested, applied),
   with each decision logged by `learning/job-outcomes.ts`.

`jobs/pipeline.ts` runs steps 1–6 for one account. It is started by
`/api/jobs/search` (streamed), `runJobPipelineAction`, `scripts/jobs-worker.ts`
and the full daily worker.

### More material widens search, never narrows it

A CV, a website or LinkedIn should find more jobs. These rules enforce it
(tests in `tests/search-breadth.test.ts`):

- **Rebuilding the profile** (`profile/rebuild.ts`) keeps the approved
  profile's roles, places, work types, languages, licences, pay and
  occupation. Survey answers go on top. A new document cannot add
  "too junior / too senior" exclusions.
- **Regenerated criteria** (`search-profile/widen.ts`) combine the approved
  titles, synonyms, places, sources and boards with the new ones. Exclusions,
  seniority and limits stay as approved. Titles beyond the five that get board
  queries move to synonyms instead of being dropped.
- **Remote-only comes from the survey alone** (`applyRemoteChoice`). A
  "Remote" in a CV or website header becomes a preference, also for criteria
  approved before this rule.
- **Collection and scoring:** board searches use the title, not title plus
  skills. Direct ATS boards take at most 60% of the raw budget when other
  sources are planned. Kept jobs are ranked (`jobs/evaluation-order.ts`: best
  title match first, sources taking turns) before the AI scoring budget.

## Client outreach: where each step lives

1. **Hiring signals**: `discovery/remotive.ts`, `discovery/arbeitnow.ts` and
   manual company entry map board postings to `DiscoverySignal`.
2. **Filter and persist**: `discovery/filters.ts` and `discovery/persist.ts`
   create companies and leads.
3. **Triage, research, score**: `discovery/triage.ts`, `research/run.ts`.
4. **Lead workflow**: `leads/lifecycle.ts`, `contacts/*`, `outreach/drafts.ts`.
5. **Send**: `mail/approvals.ts` → `mail/send.ts` (queue, suppression,
   jurisdiction) → `mail/sync.ts` / `mail/followups.ts`.

`tracking/worker.ts` runs discovery → triage → research daily
(`scripts/worker.ts`, `/api/companies/search`).

**Shared board clients.** Remotive and Arbeitnow feed both flows. The HTTP
contract for each board lives once, in `collectors/remotive.ts` and
`collectors/arbeitnow.ts`. Job search maps the rows to `RawCollectedJob`;
discovery maps the same rows to hiring signals.

## Database

- `src/db/schema.ts` is the single Drizzle schema. `src/db/migrate.ts` applies
  additive, re-runnable SQL (`CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- Per-account tables (`USER_SCOPED_TABLES` in `migrate.ts`) carry `user_id`.
  Every query on them adds `owned(table)`, and every insert sets `userId`.
- Client-outreach tables (companies, leads, contacts, drafts, mail) belong to
  the workspace owner and are reached only through owner-only actions.
- UI code never queries the database. Pages call domain queries; mutations
  go through domain actions.

## UI organisation

Large screens are split by responsibility, with one orchestrating component
and a folder of parts:

- `components/lead/`: one file per lead stage, plus the stage rules and the draft editor hook.
- `components/onboarding/`: shared controls (`ui.tsx`) and one file per screen in `steps/`.
- `components/profile/`: sources, draft editor, fields and summary card.
- `components/application-package/`: the package editor hook, toolbar and generate card.
- `components/triage/`: company search hook.

Pure mapping logic, such as onboarding flow order, profile and criteria form
values, and stream parsing, lives in `modules/` with tests.

## Checks

CI (`.github/workflows/ci.yml`) runs `pnpm lint`, `tsc --noEmit`, `pnpm test`
and `pnpm build` on every pull request and on `main`, without a database or API
keys. Tests that need `DATABASE_URL` live in `tests/integration/` and run with
`npm run test:integration`.

