# AI Job Discovery — Implementation Plan

**Product:** Private, single-user AI job scout + application prep + tracker, with client outreach as secondary mode  
**Owner:** Miloš Dostanić  
**Date:** 2026-08-01  
**Status:** Ready to sequence after outreach validation gates  
**Related:** [Product flow audit](product-flow-audit.md) · [AI job collection flow](ai-job-collection-flow.md) · [Client outreach plan](implementation-plan/00-readme.md)

---

## Product framing

| Mode | Role | Current state |
|---|---|---|
| **Jobs** (primary) | Discover roles → match profile → research → prepare application → track | Not built |
| **Clients** (secondary) | Discover companies needing design help → outreach | Built in `client-outreach/` (Phases 0–5 code) |

Both modes share: discovery feeds, company research, LLM routing/budgets, triage UX, learning machinery, mail follow-up patterns.

Do **not** fork a second app. Extend `client-outreach/` into a dual-mode product (rename later if needed). Keep single-user, localhost-first, SQLite.

---

## Correct order of work

1. Finish outreach validation (prove research, scoring, writing quality)
2. Structured professional profile (without this, matching is noise)
3. AI search profile (titles/locations/keywords Apify will use — see [collection flow](ai-job-collection-flow.md))
4. Jobs as first-class entities + focused collectors + rule filters
5. Explained job-match scoring + ≤20 daily shortlist
6. Application prep pack (grounded writing)
7. Application pipeline + attention views
8. Follow-ups + activity for job applications
9. Dual-mode polish (Companies, Opportunities, Profile, Settings)
10. Adaptive Job Search Intelligence — outcome signals → weekly insights → versioned search strategies (human-approved)
11. Only then expand Apify sources / LinkedIn Jobs (optional) / deeper automation

Do not build auto-apply, LinkedIn *account* automation, or mass sequences. Do not silent-apply profile or scoring changes. Optimize for **interview / response / offer rate**, not application volume. Apify is the focused job-collection layer; AI does not scrape.

---

## Timeline (planning estimates)

| Phase | Goal | Effort | Depends on |
|---|---|---|---|
| **J0** | Outreach validation gate | 1–2 weeks of use (ops, not build) | Existing app |
| **J1** | Profile foundation | 3–5 days | — |
| **J1.5** | AI search profile (Apify criteria) | 2–3 days | J1 |
| **J2** | Jobs entity + focused collectors + filters | 5–8 days | J1.5 |
| **J3** | Job match + daily job list (≤20) | 4–6 days | J1, J2 |
| **J4** | Application prep pack | 5–8 days | J1, J3 |
| **J5** | Applications pipeline + Today attention | 4–6 days | J4 |
| **J6** | Follow-ups, Activity, Companies | 3–5 days | J5 |
| **J7** | Adaptive Job Search Intelligence (signals → insights → strategy versions) | 6–10 days | Enough real outcome data |
| **J8** | Dual-mode IA + Settings polish | 2–4 days | J3+ |

- Usable Job MVP (profile → shortlist → match → prep → track): **~4–7 weeks** part-time after J0  
- Full vision including adaptive intelligence + secondary mode polish: **~9–14 weeks** part-time  

---

## Phase J0 — Outreach validation gate

**Goal:** Confirm the shared research/scoring/writing engine is worth building on.

**Type:** Ops / evaluation (minimal code)

### Checklist

- [ ] Run worker on ≥5 consecutive weekdays
- [ ] ≥50% of daily shortlist worth reviewing (human judgment)
- [ ] Spot-check research claims vs sources (`npm run eval:research`)
- [ ] Evaluate ~20 outreach drafts (`npm run eval:writing`)
- [ ] Complete mailbox DNS checklist before live SMTP (if using send)
- [ ] Tick Admin → Validation readiness items that apply

### Definition of done

Research briefs are mostly factual, scores are directionally useful, drafts need light edits not full rewrites. If this fails, fix outreach quality before investing in job mode.

### Exit criteria to start J1

Either J0 passes, **or** you explicitly accept risk and proceed because job matching uses a new scorer (still recommended to keep research retrieval as-is).

---

## Phase J1 — Profile foundation

**Goal:** User has an approved structured professional profile the rest of the system can trust.

### Build checklist

#### Data model

- [x] `profile_sources` — type (`cv` | `portfolio_url` | `linkedin_text` | `manual` | `document`), raw text/path, hash, ingested_at
- [x] `structured_profiles` — versioned JSON (see schema below) + `approved_at` + `status` (`draft` | `approved`)
- [x] Keep existing `settings.profile_md` as freeform positioning blurb (synced or derived summary)

#### Structured profile schema (minimum)

```text
currentRole, seniority, yearsExperience
strongestSkills[]
industries[], productTypes[]
relevantProjects[]          # title, summary, outcomes, tools — grounded only
designTools[], technicalTools[]
leadershipExperience
preferredEmploymentTypes[]  # full-time, contract, fractional, freelance
preferredLocations[], timeZones[]
salaryOrRateExpectations
availability
strengthsAndDifferentiators[]
targetRoles[]
rolesBelowLevel[], rolesAboveLevel[]
languages[]
```

#### Ingestion

- [x] Upload CV (PDF → text extract) and/or paste text
- [x] Paste portfolio URL → fetch readable text (reuse page retriever)
- [x] Paste LinkedIn export / profile text (no LinkedIn automation)
- [x] Manual fields for rates, availability, preferences
- [x] LLM extraction → structured JSON (Zod validated)
- [x] Every extracted claim stores source pointer where possible

#### UI

- [x] **Profile** page (nav item)
- [x] Show generated profile; edit / remove / add fields
- [x] Explicit **Approve profile** before it is used for matching
- [x] Re-ingest creates a new draft version; does not overwrite approved silently

#### AI

- [x] Prompt: `prompts/profile/extract.md`
- [x] Route: private/local first for CV extract; public fallback only after PII redaction (see Resolved decisions #1)
- [x] Hard rule in prompt + post-check: do not invent employers, projects, metrics, skills

### Out of scope for J1

- Job matching
- Multi-CV versioning per application
- Automatic LinkedIn OAuth

### Definition of done

User can ingest ≥1 source, review a structured profile, approve it, and see it persisted. Re-open app → approved profile still used as matching input.

---

## Phase J1.5 — AI search profile

**Goal:** AI turns the approved professional profile into a stored, reusable Apify/search criteria object. User does not hand-tune every keyword for the first run.

**Spec:** [AI job collection flow](ai-job-collection-flow.md) Steps 1–2.

### Build checklist

- [x] `job_search_profiles` — versioned `params_json`, status `draft` | `approved` | `superseded`, trigger, model/cost metadata
- [x] Prompt: `prompts/jobs/search-profile.md` — titles, exclusions, locations, keywords, employment, salary, industries
- [x] Zod schema matching the Apify search profile contract
- [x] Generate draft on profile approve; Settings UI to review / edit / approve (`/search-criteria`)
- [x] Active approved profile is the only input to collectors (no ad-hoc broad scrapes)

### Out of scope for J1.5

- Running Apify
- Auto-updating criteria from likes/rejects (J7)

### Definition of done

After approving a structured profile, user can review an AI-generated search profile, approve it, and see it persisted for the next discovery run.

---

## Phase J2 — Jobs entity + focused collectors + filters

**Goal:** Open roles exist as first-class records; collection follows the approved search profile (focused title×location queries), not broad category scrapes.

**Spec:** [AI job collection flow](ai-job-collection-flow.md) Steps 3–4.

### Build checklist

#### Data model

- [x] `jobs` table:
  - companyId, title, description, responsibilities summary
  - location, remotePolicy, employmentType
  - salaryMin/Max/currency (nullable)
  - source, externalId, sourceUrl
  - postedAt, expiresAt (nullable)
  - status: `active` | `expired` | `suppressed` | `filled_unknown`
  - idempotency: `source + externalId`
- [x] `collector_runs` — query, source, result_count, cost, status
- [ ] Link `signals` → optional `jobId` (signal can still create/update company)
- [x] `job_suppressions` or reuse pattern: rejected jobs, already applied, rejected companies

#### Collectors

- [x] Expand search profile → title × location query matrix (hard caps)
- [x] Remotive / Arbeitnow adapters emit **job rows** + company upsert (MVP baseline, zero Apify)
- [x] Apify adapters for ATS / local boards (Greenhouse, Lever, Ashby, Infostud, HelloWorld) behind cost + result limits (~60–100 raw/day)
- [x] Shared `RawCollectedJob` → normalize path
- [ ] Manual “add job URL” (best-effort extract)
- [x] LinkedIn Jobs via Apify: **deferred** (optional later; ToS risk — see collection flow C6)

#### Deterministic filters (no AI)

- [x] Excluded titles, excluded keywords, wrong employment type, unsuitable seniority
- [x] Too old / outside `postedWithinHours`
- [x] Remote-from-Serbia / EU TZ (hard exclude on-site/relocation; soft penalty for ambiguous TZ — Resolved decisions #5)
- [x] Deduplicate: source+externalId, URL, title+company fingerprint
- [x] Skip already reviewed / applied / suppressed

#### Worker

- [x] Stages: expand queries → collect → normalize → filter → dedupe → persist_jobs
- [ ] Expiry pass: mark stale jobs inactive
- [x] Client-mode path unchanged: jobs/signals can still feed outreach leads

### Out of scope for J2

- Match scoring UI
- LinkedIn account automation
- Broad open-web category scrapes

### Definition of done

Worker run uses the approved search profile, collects a bounded raw set, creates deduped `jobs` with company links, and drops obvious junk without LLM. Existing outreach lead flow still works.

---

## Phase J3 — Job match scoring + daily job list

**Goal:** Every morning, a ranked list of jobs with explained match scores against the approved profile.

### Build checklist

#### Scoring

- [x] Prompt: `prompts/jobs/match-and-explain.md`
- [x] Input: approved structured profile + job posting + optional light company context
- [x] Output schema:
  - `overallMatch` (0–100, or compute in code from weighted dims)
  - dimensions: experience, industry, designSystems, leadership, locationTimezone, employmentType, language, compensation, portfolioFit
  - each dim: rating + short evidence
  - `mainRisk`, `missingRequirements[]`, `strongestReasons[]`
  - `recommendation`: `apply` | `consider` | `skip`
- [x] Persist on `job_matches` (jobId, profileVersion, scoreJson, modelId, promptVersion, cost)
- [x] Budget metering via existing `api_usage`

#### Research reuse

- [ ] For top-N matches only: run existing company research (or reuse recent brief by companyId + freshness window)
- [ ] Job detail shows research + match side by side

#### UI

- [x] Today supports **Jobs** tab (default; persist last-used — see Resolved decisions #2) and **Clients** tab (existing triage)
- [x] Opportunity card fields:
  - company, role title, location, remote, employment type
  - match score, strongest reasons, main concern
  - date posted, source, deadline if known
- [x] Actions: **Interested** · **Not interested** · **Save for later** · **Already applied**
- [x] Reject/not-interested requires reason (reuse pattern)
- [ ] Optional **Opportunities** page: all jobs with filters (score, status, source)

#### Worker

- [x] Stages: filter active jobs → `llm_job_evaluate_batch` (survivors only) → rank → `publish_daily_job_list`
- [x] Quality floor: do not pad to quota; deliver ≤20 (fewer OK)
- [x] Skip jobs user already reviewed/applied; skip rejected companies if configured

### Out of scope for J3

- Cover letters / application pack
- Interview prep

### Definition of done

Daily Jobs list shows ≤20 ranked roles with explained scores (target ~20 when supply allows). Triage actions persist. No score without explanation. Weak matches never fill empty slots.

---

## Phase J4 — Application prep pack

**Goal:** Interested → full grounded application package the user can edit and send manually.

### Build checklist

#### Data model

- [ ] `application_packages` (or `applications` with embedded pack):
  - job analysis summary
  - company research snapshot ref
  - skill match breakdown
  - missing/weaker requirements
  - apply recommendation
  - positioning suggestion
  - portfolioProjectIds/refs
  - cvEmphasis notes
  - coverLetter / applicationEmail (generated + final)
  - suggestedQa[] , interviewPrep[]
  - grounding: list of profile fields / project ids used

#### Generation

- [ ] Trigger only after **Interested** (or explicit Generate)
- [ ] Private writing model (Claude) for letter/email; cheaper model OK for analysis structure
- [ ] Prompts:
  - `prompts/jobs/application-analysis.md`
  - `prompts/jobs/cover-letter.md`
  - `prompts/jobs/interview-prep.md` (can be one call with sections)
- [ ] **Grounding enforcement:**
  - only cite projects/skills present in approved profile
  - post-validator rejects invented employer/project names
  - label inferences vs facts

#### UI (opportunity detail)

- [ ] Complete job analysis
- [ ] Company research
- [ ] Skill-match breakdown + gaps
- [ ] Apply recommendation
- [ ] Positioning + portfolio picks + CV emphasis
- [ ] Editable cover letter / application email
- [ ] Copy email · open job application URL · notes field
- [ ] Mark package **Prepared**

### Out of scope for J4

- Auto-submit to ATS
- Generated PDF CV files (notes/emphasis only is enough for MVP)
- Multi-file CV template engine

### Definition of done

For an Interested job, user gets an editable pack that does not invent experience. Copy + open source URL + mark prepared works.

---

## Phase J5 — Applications pipeline

**Goal:** Every opportunity moves through a clear apply pipeline with attention buckets.

### States

```text
discovered
interested
prepared
applied
reply_received
interview
offer
rejected
withdrawn
closed
```

### Build checklist

- [ ] `applications` table: jobId, companyId, state, appliedAt, sourceUrl, notes, packageId
- [ ] Explicit transitions + activity log entries
- [ ] Actions: mark submitted (date), add notes, move to reply/interview/offer/rejected/withdrawn/closed
- [ ] **Applications** page:
  - waiting to submit (interested/prepared)
  - no response (applied, aged)
  - replies / interviews / offers
  - rejected / closed
- [ ] Today attention strip:
  - best new jobs
  - applications ready to send
  - replies needing attention
  - follow-ups due
  - interviews / deadlines
- [ ] Never auto-transition to `applied` without user action

### Definition of done

User can take a job from discovered → applied → interview/rejected and see correct buckets on Applications + Today.

---

## Phase J6 — Follow-ups, Activity, Companies

**Goal:** Close the loop after apply; make history and company memory usable.

### Follow-ups

- [ ] After N days with no response (configurable, default 7–10), suggest follow-up
- [ ] Generate short human follow-up from original application + role + company + elapsed time
- [ ] User edits and sends manually (or approval-gated email if mailbox already live)
- [ ] Prompt: `prompts/jobs/follow-up.md`

### Activity

- [ ] Global **Activity** page: chronological applications, emails, replies, interviews, status changes
- [ ] Reuse `activities` table with `entityType` (`lead` | `job` | `application`)

### Companies

- [ ] **Companies** browse page: search, prior jobs, prior leads, contacts, research freshness
- [ ] Company detail: opportunities history + interaction history

### Definition of done

No-response applications surface follow-up suggestions. Activity shows a cross-entity timeline. Companies are browsable without opening a lead/job first.

---

## Phase J7 — Adaptive Job Search Intelligence

**Goal:** Continuously learn from real job-search outcomes and improve future recommendations — like an optimization engine iterating a marketing campaign. Maximize interview rate, recruiter response rate, offer rate, and application efficiency — **not** application volume.

**Framing:** Static preferences are the starting point (J1.5). Outcomes are the training data. Every completed application cycle should make the next search strategy measurably better. Major changes stay human-approved; the system never silently rewrites the search profile.

**UX references (Mobbin):** Patterns below are grounded in real product screens — cite links when implementing UI.

### North-star loop

```text
Search Strategy vN
  → collect → shortlist → apply
  → outcomes (reply / interview / reject / offer)
  → AI evaluation (patterns + evidence)
  → weekly insights + strategy proposal
  → user Accept / Edit / Reject
  → Search Strategy vN+1
  → compare interview rate vs vN
```

### Learning sources (signals to capture)

Capture continuously; each signal carries timestamp, job/application id, and strategy version so cohorts stay comparable.

| Signal | Weight hint | Notes |
|---|---|---|
| Viewed job | Weak | Dwell / open without action |
| Saved / liked | Medium+ | Explicit interest |
| Ignored / dismissed | Medium− | Soft negative |
| Rejected recommendation (+ reason) | Strong− | Required reason chips after N rejects |
| Applied | Strong+ | High-confidence positive for search fit |
| Recruiter response | Strong+ | Primary optimization signal |
| Interview invitation | Stronger+ | Primary success metric |
| Rejection (post-apply) | Strong− | Segment by stage (ghost / screen / onsite) |
| Offer / accepted offer | Strongest+ | Rare; high leverage for pattern mining |
| Time-to-response | Contextual | Days from apply → first reply |
| Application pack edits | Medium | Which skills/phrases user keeps (`draft_edits`) |
| Explicit user feedback | Strong | Thumbs / freeform on insight or proposal |

#### Build checklist — instrumentation

- [ ] Triage events: viewed, saved, liked, ignored, rejected (+ reason taxonomy)
- [ ] Application state transitions as outcomes (reuse J5 pipeline)
- [ ] Recruiter replies, interviews, rejections, offers, accepted offers
- [ ] `days_to_first_response`, `days_to_interview` derived fields
- [ ] Application edits (cover letter diffs — reuse `draft_edits` pattern)
- [ ] Follow-up outcomes
- [ ] Pin `search_strategy_version` (or `job_search_profiles.version`) on every match + application
- [ ] Optional freeform “why this failed / worked” note on terminal states

### AI performance analysis

Continuously analyze cohorts with enough sample size. Prefer relative rates over absolute counts.

Patterns to surface when evidence clears gates:

- Which **job titles** generate the highest interview rate
- Which **industries** respond most frequently
- Which **company sizes** produce the best results
- Which **countries / regions** have the highest success rate
- Which **salary ranges** correlate with interviews
- Which **application styles** (skills emphasized, portfolio picks) perform best
- Which **skills** appear most often in successful applications
- Which **companies / company types** repeatedly reject or ignore

#### Build checklist — analysis engine

- [ ] Outcome aggregation by title, industry, company size, region, salary band, strategy version
- [ ] Minimum-n guards (no insight without sample; show “need N more applications”)
- [ ] Lift vs baseline (e.g. “Remote EU responds **2.8×** vs US-only”) — never invent precision
- [ ] Negative patterns (healthcare req → consistent reject) with company/job examples
- [ ] Skill / phrase extraction from packs that got responses vs silence
- [ ] Company denylist *proposals* (not silent blocks) for repeated ghost/reject

### Dynamic search strategy

Instead of a static search profile, evolve priorities from outcomes:

- Increase priority for industries / titles / sizes producing interviews
- Reduce priority for segments producing only rejections or ghosts
- Discover adjacent titles that match background + outcomes
- Stop querying titles that never produce results
- Adjust preferred company size and locations
- Recommend expanding or narrowing salary expectations when evidence supports it

Still: **proposals with diffs**, not silent rewrites of titles/locations. Bounded keyword/weight tweaks may soft-apply only after an explicit user opt-in (Settings) and never on first ship — same gate as [collection flow](ai-job-collection-flow.md).

#### Build checklist — strategy proposals

- [ ] Search profile diffs — titles, exclusions, keywords, locations (feeds next Apify matrix)
- [ ] Target role / seniority adjustments
- [ ] Company / industry preference boosts & demotions
- [ ] Match weight proposals (**wire weights into scorer**)
- [ ] Rate / location filter suggestions
- [ ] Messaging / positioning / portfolio-pick suggestions
- [ ] Profile update suggestions (CV / LinkedIn emphasis)
- [ ] Irrelevant-streak detector → draft search-profile refresh
- [ ] Closed-loop questions answered on each proposal: what increased / decreased interview probability; which companies to prioritize; which titles to expand; which filters to remove; which skills to emphasize

### Search strategy versioning

Treat each approved search profile as a versioned experiment cohort.

```text
Strategy v1  →  ~30 applications  →  AI evaluation
     ↓
Strategy v2  →  higher interview rate?
     ↓
Strategy v3  …
```

#### Data model additions

```text
job_search_strategies          # alias / view of job_search_profiles + metrics
  version, status (draft|active|superseded),
  params_json, parent_version,
  activated_at, superseded_at,
  hypothesis_md                # “Boost B2B SaaS 50–300; demote healthcare req”

strategy_cohort_metrics
  strategy_version,
  applications_n, responses_n, interviews_n, offers_n,
  response_rate, interview_rate, offer_rate,
  median_days_to_response,
  computed_at

job_outcome_events             # or extend learning events
  type, job_id, application_id,
  strategy_version, payload_json, created_at

weekly_job_insight_reports
  week_start, narrative_json, metrics_snapshot_json,
  proposal_ids[], status, created_at
```

#### Build checklist — versioning

- [ ] Every approve creates `vN+1` and supersedes previous active
- [ ] Cohort metrics roll up per version (applications → response → interview → offer)
- [ ] Compare view: vN vs vN−1 with primary KPI = interview rate (secondary: response, offer, efficiency)
- [ ] Significance / confidence label when n is low (“Not enough data — need ~10 more interviews”) — do not fake win probability
- [ ] Rollback: reactivate prior version without losing history
- [ ] Hypothesis text stored with each version (what we changed and why)

### Weekly strategic insights

Every week (or when a cycle gate hits), generate a short narrative briefing + actionable proposals.

Example insight copy (evidence-backed only):

- “You received interviews primarily from B2B SaaS companies between 50 and 300 employees.”
- “Remote European companies respond 2.8× more often than US-only companies.”
- “Applications emphasizing Design Systems and AI products generated significantly more recruiter responses.”
- “Companies requiring healthcare experience consistently reject your profile.”

#### Build checklist — insights

- [ ] Weekly job report job (reuse outreach `learning_reports` pattern; Jobs section)
- [ ] 3–5 insight bullets max; each with metric, sample size, example jobs/companies
- [ ] Auto-attach draft strategy proposal when insight implies a search-profile change
- [ ] Today chip when a new report is ready (“Weekly search review ready”)
- [ ] Archive past weeks; no spam if no new outcomes

### Gates

- [ ] Minimum data before **proposals**: e.g. 30 days **OR** 40 triage decisions **OR** 15 applications with ≥1 outcome beyond Applied
- [ ] Minimum data before **rate claims** in insights: e.g. ≥5 applications in a segment for directional; ≥10 for “× lift” language
- [ ] Force / preview mode for empty-data demos (same as outreach learning gates)
- [ ] UI on existing `/learning` — Jobs vs Clients tabs

### UX specification (Mobbin-informed)

Keep Learning as one hub; do **not** invent a second analytics app. Surface adaptive intelligence in three layers: Today (ambient), Applications (outcome capture), Learning (control plane).

#### 1. Learning hub — three tabs

Extend `/learning` for Jobs mode:

| Tab | Purpose | Mobbin pattern |
|---|---|---|
| **Insights** | Weekly briefing + KPI strip | [Origin diagnosis summary](https://mobbin.com/screens/bed7d0fb-8552-46b4-b21d-c930160b72a3) · [Vercel Speed Insights health](https://mobbin.com/screens/7ecc2280-d362-4eb8-9810-9fe1b8ce252e) · [TheyDo metrics + detail](https://mobbin.com/screens/f2909379-b7d9-4a96-bd0d-bb383d09a62c) |
| **Proposals** | Accept / Edit / Reject with evidence | [Zapier AI recommendations](https://mobbin.com/screens/3d04dc70-ff09-497f-a3d3-f43537423973) · [Peec AI suggested actions](https://mobbin.com/screens/a33f472c-a45f-4a1d-bcab-6aa85d66c70e) · existing outreach proposal cards |
| **Strategies** | Version history + cohort compare | [Amplitude experiment summary](https://mobbin.com/screens/085abd33-4b85-41d8-a7d8-60d7f08cee12) · [Klaviyo A/B results + Choose winner](https://mobbin.com/screens/db673f3f-2e68-425a-a707-3c3de365239b) · [Braintrust experiments LATEST](https://mobbin.com/screens/14781e20-980e-4881-b263-e5db605de795) |

**Insights layout (one composition, top → bottom):**

1. **KPI strip (4 max):** Interview rate · Response rate · Offer rate · Apps per interview (efficiency). Show Δ vs previous strategy version, not vanity “applications sent.” Pattern: [Maze results KPIs](https://mobbin.com/screens/c347b3d3-1846-49c5-9bd4-90caa0f08856) · [Wellfound recruiter metrics](https://mobbin.com/flows/6587426c-6037-4b14-bcf7-f7ff2e32da9a).
2. **Narrative briefing:** “Here’s what changed this week” + 3 diagnosis columns + one “What this means” wrap. Pattern: [Origin](https://mobbin.com/screens/bed7d0fb-8552-46b4-b21d-c930160b72a3).
3. **Progress to next evaluation:** “12 / 30 applications in Strategy v2 before next review.” Pattern: [Midjourney personalization progress](https://mobbin.com/flows/415b95de-6329-4b27-bc52-3b06dcc912a4).
4. **Primary CTA:** “Review Strategy v3 proposal” → Proposals tab.

**Proposals cards:** Insight headline → evidence (n, lift, 2–3 example jobs) → proposed diff (titles +/−, locations, weights) → **Accept / Edit / Reject**. Reject asks for a short reason (feeds the loop). No multi-stat dashboard chrome.

**Strategies tab:** Table of versions with `LATEST` / `Active` badge, applications n, interview rate, response rate, activated date. Row click → compare to previous (hypothesis + what changed + KPI delta). Low-n rows show “Insufficient data” instead of fake significance. Optional “Reactivate” for rollback.

#### 2. Adaptive learning controls

- **Adaptive ranking toggle** (on by default after first approved strategy): when off, use last manually approved static criteria only. Pattern: [Gemini Personal Intelligence](https://mobbin.com/screens/4f8c9f77-fcf1-4191-ad8d-934bd6aab17b) · [Midjourney personalization on/off](https://mobbin.com/flows/c236322d-0c9d-4adc-9b8c-1bae466e96ce).
- Settings copy: what is learned, what never auto-applies (titles / locations / salary hard bounds).

#### 3. Outcome capture in Applications (feeds the loop)

Pipeline stages must be one-click and complete — ghost outcomes are as important as interviews. Pattern: [Wellfound ATS columns](https://mobbin.com/flows/6587426c-6037-4b14-bcf7-f7ff2e32da9a) · [Glassdoor Job activity Saved/Applied](https://mobbin.com/flows/9f33a7bf-f182-4602-aa5d-9cb8a79054a3) · [Homerun Candidates status tabs](https://mobbin.com/flows/f410b24b-8a8d-411c-9152-1842ce36fb46).

- [ ] Terminal-state prompt: “What happened?” (no reply / rejected / withdrew) with optional note
- [ ] Interview / offer date fields for time-to-response metrics
- [ ] Strategy version badge on application detail (which strategy sourced this job)

#### 4. Lightweight feedback during triage

- [ ] Reject reason chips (wrong title, seniority, location, industry, comp, company type) — required after 3 rejects in a session
- [ ] Optional “teach with pairs” later: which of these two jobs is closer to ideal? Pattern: [Midjourney pair ranking](https://mobbin.com/flows/90c1f072-afb0-4ed1-acca-a558d9119bdc) — **defer** until after weekly insights ship
- [ ] Saved / Hide on job cards as first-class signals (Wellfound Jobs browse pattern)

#### 5. Today (Jobs) — ambient, not a dashboard

First viewport stays job shortlist. Adaptive intelligence appears as:

- One insight chip when a weekly report is unread
- Strategy version pill (`v2 · interviewing ↑`) in header
- No KPI grids, experiment tables, or proposal lists on Today

### Worker / AI routing additions

| Task | Suggested route | Notes |
|---|---|---|
| Outcome aggregation | Code | Deterministic cohort metrics |
| Weekly insight narrative | Private mid-tier | Grounded on computed metrics JSON only |
| Strategy diff proposal | Public mid-tier or private | Structured JSON diff + evidence ids |
| Pair / ranking teach (later) | Cheap public | Only if pair UX ships |

Worker stages to add (after enough data):

```text
aggregate_strategy_cohort_metrics
maybe_generate_weekly_job_insights
maybe_propose_search_strategy_update   # human approve → new version
```

### Definition of done

- Outcomes from triage + applications are stored with strategy version
- Weekly insights render with evidence and sample sizes (or honest “not enough data”)
- Strategy proposals show diffs; Accept creates `vN+1` and drives next Apify matrix
- Strategies tab compares interview / response / offer rates across versions
- Adaptive toggle and human gates respected; nothing important changes silently
- Success metric of the system itself: interview rate trend across versions (not apps/week)

---

## Phase J8 — Information architecture polish

**Goal:** Nav and settings match the product vision.

### Nav target

```text
Today
Opportunities
Applications
Companies
Profile
Activity
Settings
── secondary ──
Clients (or Clients inbox)   # existing outreach
Queue                        # outreach send queue
Learning
Admin
```

### Settings

- [ ] Connected sources (CV, portfolio URL, pasted LinkedIn text)
- [ ] Job search criteria (titles, seniority, remote, TZ, rate, employment type)
- [ ] Client discovery criteria (existing filters)
- [ ] AI budget (shared)
- [ ] Privacy / export / retention (existing)
- [ ] Notification preferences (local reminders OK for MVP)

### Definition of done

First-time user understands Jobs vs Clients. Primary morning path is Today → job → prep → Applications.

---

## Architecture additions

### New modules (suggested)

```text
client-outreach/src/modules/
  profile/          # ingest, extract, approve
  search-profile/   # AI criteria → approve → version for collectors (strategy vN)
  collectors/       # Apify + Remotive/Arbeitnow adapters
  jobs/             # persist, filters, queries, triage actions
  matching/         # job-vs-profile evaluate + rank
  applications/     # state machine, packages, follow-ups
  learning/         # extend: job outcomes, weekly insights, strategy proposals
```

### Worker stages (job mode)

```text
generate_or_refresh_search_profile   # if triggered; approve gate outside worker
expand_collector_queries             # title × location × source
run_collectors                       # Apify + free APIs; hard caps
normalize
deterministic_job_filter             # no LLM
deduplicate
persist_jobs
llm_job_evaluate_batch               # survivors only (~25–40)
retrieve_pages                       # top-N companies only
research_and_score_batch             # company research reuse
rank_jobs
publish_daily_job_list               # ≤20, quality floor
record_usage
aggregate_strategy_cohort_metrics    # J7; per strategy version
maybe_generate_weekly_job_insights   # J7; grounded narrative
maybe_propose_search_strategy_update # J7; human approve → vN+1
```

Client/outreach stages remain available in the same worker or a flag-controlled path.

### AI routing (additions)

| Task | Suggested route | Notes |
|---|---|---|
| Profile extract | Private or careful public | CV may be sensitive |
| Job triage prefilter | Cheap public | High volume |
| Job match + explain | Public mid-tier | Structured JSON |
| Application analysis | Public or private | Structured |
| Cover letter / follow-up | Private Claude | Same as outreach writing |
| Interview prep | Private | Grounded |
| Weekly job insights | Private mid-tier | Metrics JSON in → narrative; no invention |
| Strategy diff proposal | Mid-tier | Structured diff + evidence ids |

Respect existing monthly hard stop (~$8 configurable). Job matching will increase volume — add per-stage caps and top-N research limit.

### Idempotency keys (additions)

```text
source + externalId                      # jobs
jobId + profileVersion + promptVer       # matches
applicationId + packageVersion           # application packs
applicationId + followUpIndex            # follow-ups
strategyVersion + weekStart              # weekly insight reports
strategyVersion + proposalKind + window  # strategy update proposals
```

---

## Scope

### In scope for Job MVP (J1–J5)

- Structured profile from CV/text/portfolio URL
- AI-generated, human-approved search profile
- Focused collectors: Remotive + Arbeitnow + manual job URL; Apify ATS/local when wired
- Rule-based pre-LLM filter + dedupe
- Explained match scores on survivors only
- Company research on strong matches
- Daily job list (≤20, no weak fill) + triage
- Grounded application pack
- Manual apply tracking pipeline
- Local single-user app

### Deferred

- LinkedIn Jobs via Apify (optional; ToS risk)
- Extra Apify sources beyond MVP set
- Extra research providers (Firecrawl, Exa, Tavily)
- Generated tailored PDF CV
- Calendar sync for interviews
- Remote deploy / multi-user
- Contact provider for outreach (still stub-OK)
- Funding/news signal feeds for client mode

### Permanent non-goals

- Automatic job applications without user approval
- LinkedIn **account** automation / session scraping
- Broad category scrapes / thousands of unrelated jobs to “feed the model”
- Mass email sequences / open-tracking pixels
- Purchased bulk contact databases
- Silent profile, search-profile, or scoring changes (major)
- Optimizing for application volume over interview / offer rate
- Multi-tenant SaaS

---

## Success metrics

### Job MVP

| Metric | Target |
|---|---|
| Daily shortlist worth reviewing | ≥50% |
| Match explanation useful (no mystery score) | ≥80% of reviewed jobs |
| Application pack edit distance | Light edits, not full rewrite, on ≥50% |
| Invented-experience incidents | **0** tolerated in shipped packs |
| Time to first “ready to send” pack | <15 min from Interested |
| AI cost | Stay under monthly hard limit with headroom |

### Adaptive intelligence (J7)

| Metric | Target |
|---|---|
| Primary | Interview rate ↑ across strategy versions (v2+ vs v1) |
| Secondary | Recruiter response rate ↑; offer rate ↑ when sample allows |
| Efficiency | Applications per interview ↓ over time (same or better interview count) |
| Insight quality | ≥80% of weekly insights judged “actionable / true” by you |
| Proposal accept rate | Directionally useful (not a hard gate); reject reasons captured |
| Honesty | **0** invented lift stats; low-n segments show “need more data” |

### Stop / rethink conditions

- Match scores uncorrelated with your interest after 2 weeks
- Packs regularly invent experience despite guards
- Daily list dominated by irrelevant seniority/location after filter tuning
- Strategy versions churn without interview-rate movement after 2+ full cycles
- Insights regularly hallucinate patterns not in the metrics JSON

---

## Suggested build order (concrete)

1. **J0** — use outreach app; fix only blocking quality issues  
2. **J1** — profile schema + ingest + Profile page + approve  
3. **J1.5** — search profile generate/approve (Apify criteria contract)  
4. **J2** — `jobs` + focused collectors + deterministic filters  
5. **J3** — evaluate prompt + `job_matches` + Today Jobs ≤20 + triage  
6. **J4** — application package generation + detail UI + grounding checks  
7. **J5** — `applications` states + Applications page + Today attention  
8. **J6** — job follow-ups + Activity + Companies browse  
9. **J8** — nav/IA rename polish (can partially start after J3)  
10. **J7** — Adaptive Job Search Intelligence once outcome data exists  
    - Instrument signals + pin strategy version  
    - Cohort metrics + weekly insights UI  
    - Strategy proposals → vN+1 → compare tab  

---

## Relationship to existing outreach plan

| Outreach artifact | Reuse for jobs |
|---|---|
| `modules/discovery/*` | Dual-write jobs |
| `modules/research/*` | Company briefs on strong matches |
| `modules/leads/*` | Pattern for triage/states; keep for Clients mode |
| `modules/outreach/*` | Pattern for grounded drafting; new job prompts |
| `modules/mail/*` | Optional later for job follow-up send |
| `modules/learning/*` | Extend event types + proposal kinds |
| Today / lead workspace UX | Clone patterns for job cards + detail |
| Budgets, worker checkpoints, Admin privacy | Shared |

Keep [implementation-plan/](implementation-plan/00-readme.md) as the outreach-specific checklist. This document is the plan for the **job-primary** product surface.

---

## Resolved decisions

| # | Decision | Choice | Why |
|---|---|---|---|
| 1 | **CV privacy** | Private-first extract; redact PII before any public-model fallback | CV is sensitive personal data; matches existing privacy posture. Default route: private/local for extract. If public fallback is needed, strip phone, postal address, DOB, national ID first. Never send raw PDF bytes to a public API. |
| 2 | **Default Today tab** | **Jobs** by default; remember last-used after first switch | Product is job-primary. First open / cold start → Jobs. After the user picks Clients (or Jobs), persist last-used mode in settings so morning habit stays sticky. |
| 3 | **Scores** | **Two separate scores** | Outreach company score (`needNow` / fit / pay / …) answers “approach as client?” Job-match score answers “apply to this role?” Sharing one number conflates modes and breaks learning weights. Keep both; never reuse outreach total as job match. |
| 4 | **Rename repo/app** | Keep `client-outreach/` through Job MVP (J1–J5) | Renaming mid-build burns path/import/docs churn for zero user value. Revisit as a dedicated chore during or after **J8** (target name: `optra`). Product UI copy can say Optra / Jobs earlier without moving the folder. |
| 5 | **Serbia remote rule** | **Hard filter + soft score penalty** | **Hard exclude:** on-site only, relocation required, country/region allowlists that exclude Serbia / remote-EU / worldwide. **Soft penalty** on match `locationTimezone` when wording is ambiguous (“US preferred”, “Americas TZ”, “hybrid UK”). Avoid dropping every unclear Remotive “Europe” listing. |
| 6 | **Job collection** | **AI search profile → focused Apify/API collect → rules → AI evaluate** | See [ai-job-collection-flow.md](ai-job-collection-flow.md). AI chooses queries; collectors fetch; code filters; LLM only on survivors. ~60–100 raw → ≤20 published. |
| 7 | **LinkedIn Jobs** | **Deferred / optional** | Not required for MVP. Permanent non-goal remains LinkedIn *account* automation. Any later Apify LinkedIn Jobs source needs explicit enable + ToS acceptance. |
| 8 | **Adaptive search** | **Outcome-optimized, versioned, human-gated** | Optimize interview / response / offer rate and efficiency — not apps sent. Weekly insights + strategy vN→vN+1 with cohort compare. Major title/location/salary changes require Accept. Bounded weight tweaks only after explicit opt-in. UX: Learning = Insights / Proposals / Strategies (Mobbin patterns). |

---

## Document control

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-07-31 | Initial plan from product-flow audit + outreach foundation |
| 1.1 | 2026-07-31 | Resolved open decisions (CV privacy, Today default, dual scores, rename timing, Serbia remote) |
| 1.2 | 2026-07-31 | Wired AI job collection flow: J1.5 search profile, focused collectors, ≤20 quality floor |
| 1.3 | 2026-08-01 | J7 → Adaptive Job Search Intelligence: outcome signals, weekly insights, strategy versioning, Mobbin UX spec |
