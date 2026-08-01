# AI-Driven Job Collection Flow

**Product:** Optra — Jobs mode (primary)  
**Status:** Target architecture for job discovery  
**Date:** 2026-07-31  
**Related:** [Job discovery implementation plan](job-discovery-implementation-plan.md) · [Product flow audit](product-flow-audit.md)

---

## Principle

```text
AI decides what should be searched.
Apify collects matching raw job data.
Application code removes obvious mismatches.
AI evaluates only the strongest remaining candidates.
```

Do **not** scrape broad categories or thousands of unrelated jobs.  
Do **not** call an LLM until deterministic filters have cut the set.  
Do **not** pad the daily list with weak matches to hit a quota.

| Daily volume | Target |
|---|---|
| Raw jobs from Apify (all focused runs) | ~60–100 |
| After rule-based filter + dedupe | ~25–40 |
| After AI evaluation + ranking | **≤20** recommendations (fewer is fine) |

---

## Pipeline overview

```text
User profile + activity
        ↓
① AI profile → search criteria analysis
        ↓
② Structured search profile (stored, versioned)
        ↓
③ Apify focused searches (title × location × source)
        ↓
④ Normalize → rule-based filter → dedupe
        ↓
⑤ Low-cost AI contextual evaluation
        ↓
⑥ Rank → publish ≤20 daily recommendations
        ↓
⑦ Feedback regenerates / tunes search profile
```

Maps onto worker stages (job mode):

```text
generate_or_refresh_search_profile   # if stale / triggered
expand_apify_queries                 # title×location×source matrix
run_apify_collectors                 # hard result + cost caps
normalize_jobs
deterministic_job_filter
deduplicate_jobs
persist_jobs
llm_job_evaluate_batch               # survivors only
rank_jobs
publish_daily_job_list
record_usage
maybe_propose_search_profile_update  # learning (gated)
```

---

## Step 1 — Analyze the user profile

### Inputs

| Source | Where it lives today |
|---|---|
| Structured professional profile | `structured_profiles` (approved) |
| CV / portfolio / LinkedIn text / docs | `profile_sources` |
| Preferences (locations, employment, salary) | profile fields + settings |
| Liked / rejected / applied jobs | job triage + `applications` (J3+) |
| Repeated irrelevant patterns | learning events / rejection reasons |

### AI responsibility

Produce **search intent**, not a copy of the profile. Determine:

- exact target job titles  
- acceptable alternative titles  
- excluded job titles  
- required vs preferred skills  
- suitable seniority band  
- acceptable locations + remote eligibility  
- employment types  
- salary / rate range  
- industries to prioritize or avoid  
- strong-match keywords  
- exclusion keywords (location locks, internship, wrong discipline, etc.)

### Constraints

- Use the **approved** structured profile only (same gate as matching).  
- Profile extract remains private-first (Resolved decision #1). Search-profile generation may use a mid-tier public model on the *already structured* profile + aggregated feedback summaries — not raw CV bytes.  
- Output must be Zod-validated before anything is stored or sent to Apify.

### Suggested output shape (analysis intermediate)

```json
{
  "targetTitles": ["Senior Product Designer", "Product Designer", "Lead Product Designer", "AI Product Designer"],
  "excludedTitles": ["Graphic Designer", "Product Manager", "UX Researcher", "Junior Designer", "Intern"],
  "requiredSkills": ["product design", "Figma"],
  "preferredSkills": ["design systems", "SaaS", "AI products"],
  "seniority": ["senior", "lead", "staff"],
  "locations": ["Remote", "Europe", "EMEA", "Serbia"],
  "remoteRequired": true,
  "employmentTypes": ["Full-time", "Contract"],
  "salary": { "min": null, "currency": "EUR", "notes": "market senior EU remote" },
  "priorityIndustries": ["SaaS", "developer tools", "AI products"],
  "avoidIndustries": [],
  "searchKeywords": ["product design", "Figma", "design systems", "SaaS", "AI products"],
  "excludedKeywords": ["US residents only", "must be based in the US", "no remote", "internship", "relocation required"],
  "rationale": ["…short bullets for human review…"]
}
```

---

## Step 2 — Generate and store an Apify search profile

Convert analysis into **executable** search parameters. This object is the contract between AI and collectors.

### Canonical schema (`job_search_profiles`)

```json
{
  "version": 3,
  "profileVersion": 2,
  "status": "approved",
  "targetTitles": ["Senior Product Designer", "Product Designer", "Lead Product Designer", "AI Product Designer"],
  "excludedTitles": ["Graphic Designer", "Product Manager", "UX Researcher", "Junior Designer", "Intern"],
  "locations": ["Remote", "Europe", "EMEA", "Serbia"],
  "employmentTypes": ["Full-time", "Contract"],
  "postedWithinHours": 48,
  "searchKeywords": ["product design", "Figma", "design systems", "SaaS", "AI products"],
  "excludedKeywords": ["US residents only", "must be based in the US", "no remote", "internship"],
  "remotePolicy": "remote_ok_required",
  "sourcesEnabled": ["greenhouse", "lever", "ashby", "infostud", "helloworld", "remotive", "arbeitnow"],
  "maxResultsPerQuery": 15,
  "maxDailyRawJobs": 100,
  "maxDailyApifyUsd": 1.5
}
```

### Persistence

| Field | Purpose |
|---|---|
| `id`, `version` | Versioned; matching runs pin a version |
| `structured_profile_id` / `profileVersion` | Traceability |
| `status` | `draft` \| `approved` \| `superseded` |
| `params_json` | Schema above |
| `generated_at`, `approved_at` | Audit |
| `generation_trigger` | `profile_approved` \| `profile_changed` \| `feedback_batch` \| `irrelevant_streak` \| `weekly_insight` \| `strategy_cycle` \| `manual` |
| `model_id`, `prompt_version`, `cost` | Metering |

### When to regenerate

| Trigger | Behavior |
|---|---|
| User approves / re-approves structured profile | Generate new **draft**; user reviews before Apify uses it (first time mandatory) |
| User likes / rejects / applies | Accumulate signals; regenerate on schedule or threshold (see Learning) |
| Repeated irrelevant results | Flag `irrelevant_streak`; propose tighter exclusions |
| Manual “Refresh search criteria” | User-initiated draft |

**Gate (aligned with J7):** major changes to `targetTitles` / `excludedTitles` / locations require human approve. Bounded keyword/weight tweaks may auto-apply after a soft threshold once learning is live — never silent on first ship.

### UI

Settings → **Job search criteria** shows the active search profile: editable titles, locations, keywords, sources, caps. “Regenerate from profile” creates a draft with AI rationale; Approve activates it for the next worker run.

---

## Step 3 — Apify as the collection layer

Apify is **only** a job data collection adapter. It does not score, match, or decide relevance.

### Query expansion

Expand into focused runs — **one approved title × one location** (and optionally per source actor):

```text
Senior Product Designer + Remote Europe
Senior Product Designer + EMEA
Lead Product Designer + Remote
AI Product Designer + Europe
Product Designer + Serbia
```

Cap the matrix: e.g. max 5 titles × 4 locations × enabled sources, with global daily raw + USD ceilings. Prefer fewer high-precision queries over covering every combination.

### Supported sources (target set)

| Source | Role | Notes |
|---|---|---|
| Greenhouse / Lever / Ashby | High-signal ATS company boards | Prefer company/ATS actors over open web crawl |
| Poslovi Infostud | Local / regional | Serbia-relevant |
| HelloWorld.rs | Local tech | Serbia-relevant |
| Remotive / Arbeitnow | Free public APIs | Keep as zero-Apify baseline; same normalize path |
| LinkedIn Jobs (via Apify) | **Optional / later** | Conflicts with permanent non-goal of LinkedIn *account* automation; public Jobs actors still carry ToS/legal risk — enable only behind explicit settings + cost gate |

**MVP collection order:** Remotive + Arbeitnow (already built) → add Apify ATS + Infostud/HelloWorld → LinkedIn Jobs only if quality/cost justify and you accept ToS risk.

### Run limits (hard)

| Limit | Suggested default |
|---|---|
| Results per Apify query | 10–15 |
| Total raw jobs / day | 60–100 |
| Apify spend / day | configurable USD hard stop |
| Concurrent actor runs | small (e.g. 2–3) to avoid bursts |
| `postedWithinHours` | 48 (tunable) |

Failed or empty runs must not retry unbounded. Record per-run cost in `api_usage`.

### Adapter contract

```ts
type JobCollectorQuery = {
  title: string;
  location: string;
  keywords?: string[];
  postedWithinHours: number;
  maxResults: number;
  source: JobSource;
};

type RawCollectedJob = {
  source: string;
  externalId: string;
  title: string;
  companyName: string;
  location?: string;
  remotePolicy?: string;
  employmentType?: string;
  description: string;
  sourceUrl: string;
  postedAt?: string;
  salaryText?: string;
};
```

All collectors (Apify actors + Remotive/Arbeitnow) emit `RawCollectedJob` → shared normalize → `jobs` table.

---

## Step 4 — Local filtering (no AI)

After collection, **application code only**:

| Drop if | Rule (examples) |
|---|---|
| Excluded title | Token / phrase match vs `excludedTitles` |
| Too old | `postedAt` older than `postedWithinHours` (or unknown + low trust) |
| Bad location | Hard Serbia-remote rule (Resolved decision #5) |
| Remote required but on-site / relocation | Hard exclude |
| Wrong employment type | Not in `employmentTypes` |
| Wrong seniority | Junior/intern patterns when excluded |
| Excluded keywords | Body / title / location text |
| Duplicate | `source + externalId`, URL hash, or title+company+location fingerprint |
| Already reviewed / applied / suppressed | Skip before AI |

Ambiguous timezone / “US preferred” → **soft** signal for Step 5/6, not hard drop (per #5).

This stage should cut most of the 60–100 raw jobs without spending tokens.

---

## Step 5 — AI contextual evaluation

Send **only survivors** to a low-cost model (Gemini Flash-Lite class, batch if available).

### Input

- Approved structured profile (compact)  
- Active search profile snapshot  
- Job: title, company, location, remote, employment type, salary text, description (truncated if needed)  
- Optional: light company context if already cached  

### Output (Zod)

```json
{
  "matchScore": 88,
  "eligibility": "eligible",
  "recommend": true,
  "matchingReasons": [
    "Strong product design background",
    "Relevant SaaS experience",
    "Advanced Figma and design system experience"
  ],
  "concerns": [
    "Healthcare experience is preferred"
  ]
}
```

Extended fields for J3 UI (compatible with existing plan):

- `eligibility`: `eligible` | `borderline` | `ineligible`  
- dimension ratings optional (experience, locationTimezone, employmentType, compensation, …)  
- `recommendation`: map `recommend` + score → `apply` | `consider` | `skip`  
- Persist on `job_matches` with `profileVersion`, `searchProfileVersion`, model/prompt/cost  

**Hard post-check:** if `eligibility === ineligible` or `recommend === false`, never publish in the daily top list regardless of score.

---

## Step 6 — Rank and deliver

### Ranking signals (ordered)

1. Profile match (`matchScore` / overall)  
2. Application eligibility  
3. Job freshness  
4. Role preference (exact target title > alternative)  
5. Company relevance (prior likes, industry priority, research if present)  
6. Salary fit  
7. User feedback similarity (liked/applied neighborhoods boost; rejected patterns demote)

### Delivery

- Publish **≤20** jobs per day to Today → Jobs.  
- Quality floor: e.g. `recommend === true` and `matchScore >= threshold` (start ~70, tune).  
- If only 8 pass → show 8. Never backfill with `skip` / weak matches.  
- Persist list idempotently per calendar day.

---

## Learning loop — Adaptive Job Search Intelligence

Feedback improves **future Apify searches** and ranking — not silent profile invention. Full product/UX spec: [job-discovery plan § J7](job-discovery-implementation-plan.md#phase-j7--adaptive-job-search-intelligence).

**Objective:** maximize interview rate, recruiter response rate, offer rate, and applications-per-interview — **not** raw application count.

| Signal | Effect on search strategy |
|---|---|
| Viewed / saved / liked | Strengthen similar titles, skills, industries, companies |
| Ignored / rejected (+ reason) | Weaken / exclude titles, keywords, companies, industries |
| Applied | Strong positive — high-confidence search fit |
| Recruiter response / interview / offer | Strongest positives — cohort pattern mining |
| Post-apply rejection / ghost | Strong negative — segment by stage; company denylist *proposals* |
| Same title rejected repeatedly | Propose removing that title from Apify queries |
| Time-to-response | Contextual — prefer segments that reply faster when rates tie |
| Pack edits / skill emphasis | Suggest what to emphasize in future applications + ranking |

### Regeneration policy (versioned strategies)

1. Buffer events until threshold (e.g. 15 triage decisions **or** 7 days **or** ~15–30 applications with outcomes).  
2. Aggregate **cohort metrics** for the active strategy version (response / interview / offer rates).  
3. Generate **weekly insights** (narrative grounded on metrics JSON) + optional strategy **diff** with evidence.  
4. User accepts / edits / rejects on Learning → **Insights / Proposals / Strategies**.  
5. Accept creates **Strategy vN+1**; previous version stays for compare / rollback.  
6. Next Apify matrix + rank weights use the new active version only.

Matches J7: proposals with evidence; strategy versioning; no silent major behavior change on day one.

### Irrelevant-streak detector

If ≥N consecutive published jobs are rejected as “irrelevant title/seniority/location”, auto-trigger a draft search-profile refresh with tighter exclusions — still require approve before Apify matrix changes.

### Closed feedback questions (each proposal should answer)

- What increased / decreased interview probability?  
- Which companies or segments to prioritize or drop?  
- Which titles to expand vs stop querying?  
- Which filters to remove?  
- Which skills to emphasize in packs and ranking?

---

## Data model additions

```text
job_search_profiles
  id, version, structured_profile_version, status,
  params_json, rationale_json, generation_trigger,
  parent_version, hypothesis_md,
  model_id, prompt_version, cost_usd,
  created_at, approved_at, superseded_at

apify_runs (or collector_runs)
  id, search_profile_version, source, query_json,
  started_at, finished_at, result_count, cost_usd, status, error

jobs                  # as in J2 — first-class
job_matches           # as in J3 — + search_profile_version
job_feedback / triage # viewed | liked | rejected | saved | ignored | applied (+ reason)
job_outcome_events    # reply | interview | reject | offer | accepted (+ timing)
strategy_cohort_metrics
weekly_job_insight_reports
```

Reuse existing: `companies`, `api_usage`, `activities`, learning proposal tables.

---

## Module layout

```text
client-outreach/src/modules/
  profile/           # exists (J1)
  search-profile/    # analyze → generate → approve → version
  collectors/        # Apify + Remotive/Arbeitnow adapters
  jobs/              # normalize, filters, dedupe, persist, triage
  matching/          # AI evaluate + rank + publish daily list
  applications/      # later (J4–J5)
  learning/          # extend for search-profile proposals
```

---

## Cost & privacy budget

| Stage | Route | Volume |
|---|---|---|
| Search profile generate | Mid-tier / Flash; structured profile + feedback summary | Rare (versions) |
| Apify collect | Apify USD cap | Daily |
| Rule filter | Free | All raw |
| Job evaluate | Flash-Lite batch | ~25–40/day |
| Rank | Code | Free |

Stay under shared monthly AI hard stop (~$8) **plus** separate Apify monthly cap. Job evaluate must not research every company — research only top-N after rank (existing J3 plan).

---

## Mapping to implementation phases

| Phase | Collection-flow work |
|---|---|
| **J1** | Done — approved structured profile feeds Step 1 |
| **J1.5** (new, short) | `job_search_profiles` + generate/approve UI + Zod schema |
| **J2** | Collectors → `jobs`; Remotive/Arbeitnow first; Apify ATS + local boards next; filters + dedupe |
| **J3** | AI evaluate + rank + Today Jobs ≤20 + triage feedback |
| **J7** | Adaptive intelligence: outcomes → weekly insights → strategy vN+1 + irrelevant-streak |

Do not block Job MVP on LinkedIn Apify. Free APIs + deterministic filters + AI evaluate already prove the funnel; Apify expands precision/coverage.

---

## Success metrics

| Metric | Target |
|---|---|
| Raw → published conversion | ~60–100 → ≤20 without padding |
| Daily shortlist worth reviewing | ≥50% |
| Share dropped pre-LLM | Majority of raw (cost control) |
| Apify + AI daily cost | Within configured caps |
| Search profile approve latency | User can regenerate and approve in one sitting |
| Irrelevant title in published list | Trending down after learning accepts |
| Interview rate across strategy versions | v2+ ≥ v1 after a full application cycle (directionally) |

### Stop / rethink

- Apify cost high but post-filter yield low → tighten matrix, drop sources  
- AI recommend rate ≈100% → evaluation prompt too soft  
- AI recommend rate ≈0% → search profile or sources wrong  
- LinkedIn actor ToS / account risk materializes → disable source permanently  

---

## Resolved decisions for this flow

| # | Topic | Choice |
|---|---|---|
| C1 | Who decides queries? | AI-generated search profile (human-approved) |
| C2 | Who collects? | Apify + free job APIs; shared normalize |
| C3 | Who filters junk? | Application rules only |
| C4 | Who judges fit? | Low-cost LLM on survivors only |
| C5 | Daily quota | Soft target 20; quality floor over fill |
| C6 | LinkedIn | Deferred / optional; not required for MVP |
| C7 | Learning | Adaptive Job Search Intelligence: versioned strategies, weekly insights, proposal + approve for title/location matrix; optimize interview/response/offer rate — not volume; no silent major changes |

---

## Document control

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-07-31 | Initial architecture from AI-driven job collection brief |
