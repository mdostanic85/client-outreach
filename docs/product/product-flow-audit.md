# AI Job and Client Discovery App — Product Flow Audit

**Date:** 2026-07-31  
**Codebase audited:** `client-outreach/` (+ `docs/implementation-plan/`)  
**Implementation plan:** [job-discovery-implementation-plan.md](job-discovery-implementation-plan.md)  
**Verdict:** Trenutni kod implementira **Client Outreach MVP** (sekundarni flow iz vision-a). Primarni job-application flow skoro uopšte nije počeo. Phases 0–5 **outreach build** je landed; otvoreni su validation/ops gateovi, ne nedostajući build moduli za outreach.

---

## Framing mismatch

| Vision (ovaj dokument) | Šta repo zapravo radi |
|---|---|
| Job scout: pronađi poslove → match → apply | Company scout: pronađi hiring signale → research → cold outreach |
| Job postings kao prvi-class objekti | Job board rezultati se kolapsuju u **company leads** |
| Application pipeline (Applied → Interview → Offer) | Lead/outreach pipeline (`suggested` → `sent` → `replied`) |
| Nav: Today, Opportunities, Applications, Companies, Profile, Activity, Settings | Nav: **Today, Queue, Learning, Style, Analytics, Admin** |
| Job applications = primary; client outreach = secondary | Client outreach = **jedini** mature product path |

Canonical implementation docs (`docs/implementation-plan/`) eksplicitno grade private single-user **client discovery and outreach** app. Vision ispod je širi product; audit meri oba.

**Status legend:** `WORKS` · `PARTIAL` · `MISSING` · `OPS-GATED` (kod postoji, nije validiran u produkciji)

---

## Product Purpose

| Aspect | Status | Notes |
|---|---|---|
| Discover companies matching experience | `PARTIAL` | Radi za outreach fit, ne za job application fit |
| Scan market for relevant open positions to **apply** | `MISSING` | Jobovi su discovery signal, ne apply targets |
| Research company, score match, explain, prepare application | `PARTIAL` | Research + score + explain rade; application prep ne |
| Later: freelance/consulting client discovery | `WORKS` | Ovo je trenutni product |

---

# High-Level User Flow — Audit

## 1. The AI Builds the User Profile

**Status: `MISSING`** (samo ručni stub)

### Šta radi
- Settings ima freeform `profile_md` (markdown positioning blurb).
- Style profile JSON: voice, do/don’t, primeri (`/settings` → Style & profile).
- Seed default profil za Miloša u `src/db/ensure.ts`.
- Profil se prosleđuje drafting LLM-u pri generisanju outreach emaila.

### Šta ne radi
- Nema upload CV/résumé.
- Nema portfolio website parse.
- Nema LinkedIn import (samo lookup linkovi za **kompanije**, ne user profil).
- Nema ingest prethodnih job applications, emailova, dokumenata, case studies.
- Nema AI strukturirani profesionalni profil (role, seniority, skills, industries, tools, rates, availability, target roles, over/under-level roles).
- Nema UI za review/korekciju AI-generisanog profila pre matchinga.

### Šta treba da se uradi
1. **Profile ingestion pipeline** — upload/parse CV (PDF/DOCX), paste portfolio URL, optional LinkedIn export/text, manual skills/rates/availability.
2. **Structured profile schema** — role, seniority, YoE, skills, industries, projects, tools, leadership, employment prefs, locations/TZ, salary/rate, availability, strengths, target roles, over/under-level roles.
3. **AI profile builder** — LLM ekstrakcija iz source materijala → structured JSON + human-editable review screen.
4. **Grounding rules** — profile claims moraju biti vezane za source; no invention.
5. **Profile page** kao prvi-class area (ne samo Settings markdown).

**Reuse:** `settings.profileMd`, style profile, learning positioning proposals (`modules/learning/proposals.ts`).

---

## 2. The Application Scans for Relevant Companies and Jobs

**Status: `PARTIAL`** (scan postoji; semantika je outreach, ne job search)

### Šta radi
- Discovery adapters: **Remotive**, **Arbeitnow**, manual URL (`modules/discovery/`).
- Title filters defaultuju ka design rolama (Senior/Lead/UX/UI/Design Systems-ish).
- Pipeline: discover → normalize → dedupe → deterministic filter → LLM triage → research.
- Remote / EU-friendly filteri delimično preko settings filters.
- Rejection/suppression sprečava ponovni predlog istih kompanija.
- Worker: `npm run worker` (`modules/tracking/worker.ts`).

### Šta ne radi
- Nema first-class **job posting** entiteta za apply (signal → company).
- Nema company career page crawling kao primarni job source.
- Nema dedupe/expiry na nivou *job listing* za application flow.
- Nema filtera tipa “junior roles out”, “relocation required out”, “already applied” u job-application smislu.
- Nema Serbia-remote eligibility kao eksplicitan job-match kriterijum.
- Nema LinkedIn Jobs / ATS watchlists (Phase 5 deferred).
- Rate/availability matching protiv job salary band-a — ne postoji.

### Šta treba da se uradi
1. **Job entity model** — `jobs` tabela odvojena od `companies`/`signals` (title, description, location, remote, employment type, salary, posted_at, source_url, status).
2. **Keep signals for client mode** — isti Remotive/Arbeitnow feed može hraniti oba moda.
3. **Job-specific filters** — seniority, remote-from-Serbia, TZ, employment type, rejected jobs, applied jobs, expired.
4. **Broader sources** (kasnije) — career pages, ATS watchlists, dodatni public feeds.
5. **Responsibility-aware matching** — ne samo title match (delimično postoji u triage LLM-u; treba job-match prompt).

---

## 3. AI Matches Every Opportunity Against the User

**Status: `PARTIAL`** (outreach company-fit score, ne job-vs-profile match)

### Šta radi
- Research+score u jednom LLM callu (`modules/research/run.ts`, `prompts/research-and-score.md`).
- Dimenzije: `needNow`, `fit`, `abilityToPay`, `accessibility`, `engagementMatch`.
- Score breakdown + evidence IDs; total računa kod.
- Daily ranked leads.

### Šta ne radi
- Nema job match score tipa “Overall match: 88%” vs CV/profile.
- Nema breakdown: experience / industry / design systems / location / employment type / English / main risk.
- Scoring weights u `settings_scoring` se mogu predložiti, ali **`calculateScoreTotal` ih ne čita**.
- Score odgovara na “da li da radim outreach?”, ne “koliko posao odgovara mom profilu?”.

### Šta treba da se uradi
1. **Job-match scorer** — novi prompt + schema vezan za structured profile + job posting.
2. **Explained score UI** — overall % + dimenzije + main risk + evidence.
3. **Zadrži outreach score** kao odvojen score za client mode.
4. **Wire scoring weight proposals** u actual score calculation (bug/gap i za outreach).

---

## 4. The Application Researches the Company

**Status: `WORKS`** (za outreach brief; dovoljno blizu vision-u)

### Šta radi
- Retrieve homepage → About → Careers → blog (`modules/research/retrieve.ts`).
- `source_pages` + `research_briefs` sa evidence excerpts.
- UI na lead workspace: šta kompanija radi, evidence, incomplete research označeno pošteno.
- Cost metering po research callu.

### Šta ne radi / slabije
- Nema Firecrawl/Exa/Tavily (namerno deferred).
- Design-team depth, funding, reputation warning signs — zavise od toga šta je javno na sajtu; nema dedicated enrichment.
- “Whether the company appears able to hire internationally” — delimično u accessibility, nije first-class claim.
- Nema odvojene Companies browse stranice.

### Šta treba da se uradi
1. Proširiti research schema za job-mode polja (hiring internationally, design team size, funding) sa source/inference/unknown labelima.
2. **Companies** area — lista, history, previous opportunities, contacts.
3. Po potrebi dodati research providere tek kad homepage retrieval failuje merljivo.
4. Eval gate ostaje otvoren: `npm run eval:research` + ljudska ocena factuality.

---

## 5. The User Receives a Daily Opportunity List

**Status: `PARTIAL`**

### Šta radi
- Today inbox (`/` + `triage-inbox.tsx`) — daily shortlist.
- Ranked publish top N (`publish_daily_list`).
- Actions: **Accept / Reject / Save for later**.
- Reject reason obavezan.
- Lead card pokazuje company, score, rationale (outreach-oriented).

### Šta ne radi
- Nema opportunity card polja: role title, location, remote eligibility, employment type, date posted, application deadline, source job URL kao apply target.
- Nema akcije **Interested** / **Already applied** (closest: Accept → outreach path).
- Nema “strongest reasons for match” / “main concern” u job-match smislu.

### Šta treba da se uradi
1. Dual-mode Today (ili tab): **Jobs to apply** vs **Clients to approach**.
2. Job opportunity cards sa poljima iz vision-a.
3. Triage akcije: Interested · Not interested · Save for later · Already applied.
4. Feedback loop u learning (isti pattern kao accept/reject).

---

## 6. The Application Prepares the Application

**Status: `MISSING`** (postoji outreach email draft umesto application pack)

### Šta radi
- Posle Accept + contact: Claude draftuje cold email (`modules/outreach/drafts.ts`).
- Quality checks + optional critique.
- Research brief pored drafta.

### Šta ne radi
- Nema complete job analysis za apply.
- Nema skill-match breakdown za application.
- Nema recommendation apply/skip.
- Nema suggested positioning, portfolio project picks, CV emphasis.
- Nema cover letter / application email grounded u real experience.
- Nema suggested answers to common questions / interview prep points.
- Anti-hallucination za projects/skills — postoji duh u outreach prompts, ali nema application grounding layer-a.

### Šta treba da se uradi
1. **Application prep module** — novi artifact tip: job analysis, match breakdown, gaps, apply recommendation, positioning, portfolio picks, CV emphasis, cover letter, FAQ answers, interview points.
2. **Grounding** — samo iz approved structured profile + cited research; explicit “do not invent”.
3. UI na opportunity detail posle Interested.
4. Eval scorecard analogan `eval:writing` za application quality.

---

## 7. The User Reviews and Applies

**Status: `PARTIAL`** (review+send outreach; ne job apply)

### Šta radi
- Inline edit draft, copy, open Gmail compose (`lib/gmail.ts`).
- Manual mark sent/replied.
- Approve-for-send → SMTP queue (Phase 3, ops-gated).
- Nikad ne šalje bez approval hash gate-a (za mail path).

### Šta ne radi
- Nema “open application page” (ATS/job board URL kao primarna CTA).
- Nema download/open tailored CV version.
- Nema mark submitted + application date + personal notes za **job applications**.
- Auto-apply ne postoji (dobro) — ali ni ručni apply workflow ne postoji.

### Šta treba da se uradi
1. Application workspace: edit cover letter, copy, open source job URL, attach/select CV variant, mark submitted, date, notes.
2. CV versioning (kasnije) — emphasize sections per opportunity.
3. Zadrži pravilo: never apply/send without explicit user approval.

---

## 8. The Application Tracks Every Application

**Status: `PARTIAL`** (outreach CRM-lite; ne application pipeline)

### Trenutni lead states
```text
new → suggested → accepted → draft_ready → sent
  → replied / follow_up_due / in_conversation
  → closed_won / closed_lost
(+ rejected, suppressed, saved_for_later)
```

### Vision pipeline (ne postoji)
```text
Discovered → Interested → Prepared → Applied
  → Reply received → Interview → Offer
  → Rejected / Withdrawn / Closed
```

### Šta radi
- Queue board za drafts/approvals/sends (`/queue`).
- Analytics funnel po lead state (`/analytics`).
- Activities log po leadu.

### Šta ne radi
- Nema `applications` tabele.
- Nema views: waiting to submit, replied, interviews upcoming, no response, follow-up due, rejected/closed **za job apps**.

### Šta treba da se uradi
1. **Applications** domain + state machine (vision pipeline).
2. **Applications** page sa filterima i attention buckets.
3. Mapirati outreach states odvojeno (client mode zadržava postojeći pipeline).

---

## 9. Follow-Up Support

**Status: `WORKS`** (za outreach; reusable pattern za job apps)

### Šta radi
- Generate follow-up 1/2 drafts (`prompts/email/follow-up.md`).
- Manual follow-up date; `follow_ups` scheduling posle send.
- Reply sync + classification (IMAP code path).
- User review before send / approval-gated SMTP.

### Šta ne radi / ops
- Live mailbox DNS/SPF/DKIM/DMARC checklist još nije zatvoren (Admin validation).
- Nema job-application follow-up template (posle Applied, no response).

### Šta treba da se uradi
1. Job follow-up generator (role + company + days since apply + prior comms).
2. Završiti mailbox ops pre live auto-send.
3. Reuse mail policy: caps, weekday window, bounce pause.

---

## 10. The System Learns From the User

**Status: `PARTIAL`** (kod spreman; data gates unmet)

### Šta radi
- Accept/reject + reject reasons → activities.
- Draft edits → `draft_edits`.
- Learning proposals: style / scoring / market / positioning (`/learning`).
- Source performance reports.
- Gates: 30d signals, 20 edits, 50 delivered (`learning/gates.ts`) — **unchecked** u ops smislu.

### Šta ne radi
- Nema učenja iz job likes/rejects, application edits, interviews, offers.
- Scoring weight apply ne utiče na research scoring runtime.
- Predlozi zahtevaju real usage data koji još nije sakupljen.

### Šta treba da se uradi
1. Event model za job triage + application outcomes.
2. Predlozi za role/company recs, match scoring, rate filters, messaging, portfolio picks, CV positioning — **propose, don’t silent-apply**.
3. Zatvoriti scoring-weights wire-up.
4. Sakupiti dovoljno podataka pre uključivanja auto-proposals u daily use.

---

# Secondary Flow: Potential Client Discovery

**Status: `WORKS`** — ovo *jeste* trenutni product

### End-to-end loop (implementiran)
```text
discover → triage → research/score → daily list
  → accept → contact harvest → draft email
  → (manual Gmail | approve+SMTP) → sync replies
  → follow-ups → learning proposals
```

### Šta radi
- Open design-role positions kao need signal.
- Company research + fit score + evidence.
- Recommended contact role (assisted).
- Personalized outreach message.
- Outreach + reply tracking.
- Suppressions, daily caps, approval gate.

### Šta ne radi / otvoreno
- Contact provider lookup = stub (`contacts/provider.ts`).
- Pattern-guessed emails zahtevaju ručnu potvrdu (by design).
- Validation DoD: 5 consecutive worker runs, ≥50% worth reviewing, claim quality, draft rewrite rate — **nije zatvoreno**.
- Mailbox ops: dedicated mailbox + DNS — **nije zatvoreno**.
- Funding/redesign/small-design-team signals — samo ono što discovery + site research uhvate; nema dedicated funding feeds.

### Šta treba da se uradi (da secondary flow “radi u praksi”)
1. Pokrenuti worker više uzastopnih radnih dana; meriti shortlist quality.
2. Evaluirati ~20 draftova (`eval:writing`).
3. Završiti mailbox setup pre live SMTP.
4. Opciono: funding/launch signal sources kasnije.

---

# Main Application Areas

| Vision area | Status | Trenutno stanje |
|---|---|---|
| **Today** | `WORKS` | `/` — daily triage inbox (outreach leads) |
| **Opportunities** | `MISSING` | Nema page; leads na Today + `/leads/[id]` |
| **Applications** | `MISSING` | `/queue` = outbound **email** queue, ne job apps |
| **Companies** | `PARTIAL` | `companies` tabela + detail na leadu; nema browse |
| **Profile** | `PARTIAL` | Ručni MD u `/settings`; nema AI structured profile |
| **Activity** | `PARTIAL` | `activities` po leadu; nema global Activity feed |
| **Settings** | `WORKS` | Split: `/settings` (style/filters/budget) + `/admin` (ops/privacy/readiness) |

**Actual nav:** Today · Queue · Learning · Style · Analytics · Admin

---

# Core Product Outcome (jutarnji checklist)

| # | Outcome | Status |
|---|---|---|
| 1 | Koje kompanije hire-uju nekoga kao mene | `PARTIAL` — kao outreach targets, ne apply list |
| 2 | Najjači match opportunities | `PARTIAL` — outreach fit score |
| 3 | Zašto je opportunity relevantan | `WORKS` — evidence-backed research |
| 4 | Rizici / missing requirements | `PARTIAL` — incomplete research; ne job-gap analysis |
| 5 | Šta handle-ovati prvo | `WORKS` — ranked daily list |
| 6 | Kako pozicionirati experience | `MISSING` za jobs; `PARTIAL` za outreach angle |
| 7 | Koji application poslati | `MISSING` (postoji outreach email) |
| 8 | Koje previous applications traže pažnju | `PARTIAL` — queue/replies za outreach, ne job apps |

---

# Inventory (šta je izgrađeno)

## Stack
- Next.js local app (bind `127.0.0.1:3000`), SQLite/Drizzle, worker script, Gemini (research/triage), Claude (writing), optional Gmail SMTP/IMAP.

## DB tables (postoje)
`settings`, `companies`, `signals`, `source_pages`, `research_briefs`, `leads`, `contacts`, `drafts`, `activities`, `suppressions`, `sync_runs`, `api_usage`, `approvals`, `threads`, `messages`, `follow_ups`, `mail_sync_cursors`, `delivery_events`, `draft_edits`, `learning_proposals`, `learning_reports`, `settings_scoring`

## DB tables (fale za job vision)
`jobs`, `applications`, `profile_sources`, `structured_profiles`, `portfolio_assets`, `cv_versions`, `cover_letters` / application artifacts, `interviews`

## AI capabilities
| Task | Status |
|---|---|
| Batch triage | Works |
| Research + score | Works |
| Contact people extract | Works |
| Outreach draft / follow-up | Works |
| Draft critique | Works |
| Reply classify | Works (code) |
| Style/market/positioning proposals | Works (gates unmet) |
| Profile builder from CV/etc. | Missing |
| Job match scorer | Missing |
| Application / cover letter pack | Missing |

## Discovery sources
| Source | Status |
|---|---|
| Remotive | Live |
| Arbeitnow | Live |
| Manual URL | Live |
| Hunter / Firecrawl / Exa / ATS / TheirStack | Deferred |

## Phase completion (outreach plan)
| Phase | Build | Validation/ops |
|---|---|---|
| 0 Vertical slice | Done | — |
| 1 Validation MVP | Done | Open DoD (runs, quality, cost) |
| 2 Contacts & quality | Done (provider stub OK) | Open (~20 draft evals) |
| 3 Gmail automation | Code done | Open (mailbox DNS, practice) |
| 4 Learning | Scaffolding done | Gates unmet |
| 5 Later | Analytics UI done | ATS, multi-user, remote deferred |

---

# Šta treba da se uradi — prioritetni roadmap

Preporučeni redosled ako je **job flow primary** (kao u vision-u), a outreach već postoji kao secondary:

## A. Završi outreach Validation MVP (kratko, već skoro gotovo)
1. 5+ uzastopnih weekday worker runova.
2. Ljudski score shortlist + research factuality.
3. ~20 draft evals; mailbox DNS pre live send.
4. Tick Admin readiness checklist.

*Bez ovoga nema pouzdanog research/scoring/writing engine-a za reuse.*

## B. Job Discovery Foundation (novi product surface)
1. Structured profile + ingestion + review UI.
2. `jobs` entity; discovery piše i u jobs i u company signals.
3. Job-match scorer + explained score UI.
4. Today dual-mode / Opportunities page + triage actions uključujući Already applied.
5. Application prep artifacts (grounded).
6. Applications pipeline + Applications page.
7. Job follow-ups + Activity feed.
8. Companies browse page.
9. Learning events za job outcomes.

## C. Reuse iz postojećeg koda (ne graditi ispočetka)
- Discovery adapters + dedupe/filter pipeline
- Page retrieval + evidence research pattern
- LLM routing, budgets, api_usage
- Triage inbox UX
- Mail approval/follow-up/sync (za outreach; delimično za job follow-up email)
- Learning proposal machinery
- Admin privacy/export/retention

## D. Eksplicitno out of scope (ostaje deferred / non-goal)
- Auto-apply na ATS
- LinkedIn account scraping/automation
- Mass sequences / tracking pixels
- Multi-tenant SaaS
- Silent auto-apply scoring/profile changes

---

# Summary matrix

| Flow step | Status |
|---|---|
| 1. AI builds user profile | `MISSING` |
| 2. Scan companies and jobs | `PARTIAL` |
| 3. AI match vs user | `PARTIAL` |
| 4. Company research | `WORKS` |
| 5. Daily opportunity list | `PARTIAL` |
| 6. Prepare application | `MISSING` |
| 7. User reviews and applies | `PARTIAL` |
| 8. Track applications | `PARTIAL` |
| 9. Follow-up support | `WORKS` (outreach) |
| 10. System learns | `PARTIAL` |
| Secondary: client discovery | `WORKS` |

**Bottom line:** Client outreach loop je izgrađen i treba ga **validirati u upotrebi**. AI job scout / application writer / application tracker iz vision-a još nije product — treba novi domain (profile, jobs, applications) na istom research + scoring + drafting + tracking foundation-u.
