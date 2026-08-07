# Company-Specific Application Package — Feasibility & Product Proposal

**Product:** Optra (job scout + application prep)  
**Owner:** Miloš Dostanić  
**Date:** 2026-08-03  
**Status:** Slice A in progress — template + slot personalization, preview/edit/approve, plain-text export shipped in code  
**Related:** [Job discovery plan](job-discovery-implementation-plan.md) (Phase J4) · [Product flow audit](product-flow-audit.md)

---

## Verdict

**Build around a stable, editable base CV template + base cover-letter template. Per company, only patch small slots (summary, skill order, which bullets/projects, letter opening/body) — do not regenerate the whole document.**

This is cheaper in tokens, easier to edit, and more consistent than rewriting a full CV each time. Preview stays HTML from the same template. Defer PDF/DOCX until the template + slot quality is proven.

Company-only packages (no job description) are useful but secondary — treat them as a constrained “interest / speculative outreach” mode, not the default.

Permanent non-goals remain: auto-submit, invented experience, silent sends.

---

## Template-first model (preferred architecture)

### Why

| Approach | Tokens / pack | Edit UX | Consistency |
|---|---|---|---|
| Regenerate full CV each time | High (~full profile + JD every call) | Hard — everything drifts | Low |
| **Base template + slot patches** | **Low** (JD + ranked slot candidates only) | **High** — edit one field | **High** |

### Base artifacts (user maintains once)

1. **`cv_base`** — approved master CV in structured slots that render through one fixed layout template  
2. **`letter_base`** — reusable skeleton: greeting · why-you · proof · ask · sign-off  

### Per-company personalization (LLM patches only)

| Slot | What changes | What stays fixed |
|---|---|---|
| Professional summary | 2–3 lines, company/role tilt | Header, education, contact |
| Skills order / subset | Reorder + pick 8–12 from approved list | Skill vocabulary (no new skills) |
| Experience bullets | Select / lightly rephrase from approved bullet bank | Employer names, titles, dates |
| Featured projects | Pick 1–3 relevant from profile | Project facts / outcomes |
| Cover letter body | Opening + 1–2 proof paragraphs | Sign-off block, contact |

Layout, fonts, margins, section order = **code/CSS template**, never LLM output.

### Recommended page length

| Market / case | Recommendation |
|---|---|
| **Default (US + most EU tech/remote EN apps)** | **1 page** |
| Senior / leadership with dense relevant history | Soft allow **2 pages** (user toggle) |
| Never | 3+ pages |

For Optra’s target (senior product/design, remote EN applications): **ship 1-page as the only MVP template**. Add a “allow page 2” density mode later if content regularly overflows — do not design two separate visual systems in MVP.

### Layout & typography (ATS-safe)

Inspired by common ATS product-design resume practice + modular editors seen in Mobbin ([Behance Creating a resume](https://mobbin.com/flows/afc83e99-6ba3-43f4-aa84-1f4afc1e4b3b), [Mercor Updating a resume](https://mobbin.com/flows/636e78b0-8b2d-46d0-a2ed-3b5d43b6e406), [Remote Resume sections](https://mobbin.com/flows/ed5e7fc6-d8f3-4b3b-a347-74db0016ab86), [Glassdoor Preview resume](https://mobbin.com/flows/810611d3-89c8-475e-b5aa-ab985eaa6814)):

```text
Page: A4 (EU default) or US Letter — user market toggle
Margins: 14–16 mm (≈0.55–0.65")
Columns: single column only (no sidebar skills column)
Accent: one hairline under name or section titles — no icons, no photo

Font: Inter (or Helvetica Neue / Arial fallback)
  Name:        20–22 pt / semibold
  Section:     11–12 pt / semibold · tracking slight · optional small-caps feel via letter-spacing
  Role/org:    10.5–11 pt / semibold
  Body/bullets:10–10.5 pt / regular · line-height 1.25–1.35
  Meta/dates:  9.5–10 pt / regular · muted

Structure:
  Header (name, title, city/region, email, phone, LinkedIn, portfolio)
  Summary (2–3 lines)                         ← personalized slot
  Skills (one line or 2 short grouped lines) ← personalized order
  Experience (2–4 roles, 3–5 bullets each)   ← bullet selection slot
  Selected work / projects (optional, 1–3)   ← pick slot
  Education (+ certs if short)
```

Cover letter: same typeface family; ~½ page; 150–220 words; editable paragraphs, not a full redesign.

### Editor UX (from Mobbin patterns)

- **Section checklist** (Remote): include/exclude Languages, Projects, etc. before export  
- **Field editor + live preview** (Behance / Mercor): edit slots on the left, A4 preview on the right  
- **Bullet bank**: approved bullets tagged by theme; personalization = select, not invent  
- Cover letter: 3–4 paragraph fields with “Regenerate this paragraph only”

### Token budget sketch

| Call | Approx input |
|---|---|
| Rank slots for job | JD + match gaps + bullet/project IDs (not full essays) |
| Rewrite summary + letter | Short slot texts only |
| Full CV regenerate | Avoid in MVP |

Target: **well under half** the cost of a full rewrite pack (~$0.08–0.20/pack vs $0.20–0.45).

---

## 1. Recommended user flow

```text
Job shortlist → Mark Interested
        │
        ▼
Offer: “Prepare application package?”
  [Prepare now]  [Later from Interested]
        │
        ▼
Confirm package settings (blocking if critical data missing)
  • Market: US | Europe (auto-suggested, user-confirmable)
  • Language: EN (MVP) · optional later
  • Target: this job (default) | company interest only
  • Sources: approved profile + selected matching sources
        │
        ▼
Generate (private writing model + grounding validator)
  • Job/company analysis snapshot
  • Tailored CV sections (structured JSON)
  • Cover letter draft
  • Gaps / warnings / evidence map
        │
        ▼
Review workspace
  • Side-by-side preview (CV | letter)
  • Edit section · regenerate section · pick alternative
  • Approve package (content hash, like outreach drafts)
        │
        ▼
State → Prepared
  • Export: plain text (MVP) · PDF/DOCX (phase 2)
  • Copy letter · open external apply URL · mark Applied later
  • Package available for future email/proposal attach — never auto-sent
```

Trigger also available from `/interested` and (later) company/lead detail for company-only mode.

---

## 2. MVP scope

### In MVP

| Capability | Notes |
|---|---|
| Trigger after Interested (or explicit Generate) | Same gate as J4 |
| Grounded job + company analysis | Reuse match result + research brief / company snapshot |
| Tailored CV as **structured sections** | Reordered/emphasized from approved `StructuredProfile` only |
| Personalized cover letter / apply email | Private Claude; editable; alternatives optional |
| Full in-app preview | Render from structured JSON (source of truth) |
| Section edit + regenerate + approve | Draft → final with content hash |
| Evidence / grounding panel | Which profile fields, projects, company facts were used |
| Missing-data warnings | Block or soft-warn before generate |
| Plain-text export | ATS forms + email body paste |
| Package versioning | Regenerate creates new version; keep last approved |
| No automatic send | Explicit future attach/send only |

### Out of MVP (phase 2 / later)

- ATS-friendly PDF generation (selectable text)
- Editable DOCX
- Multi-template visual design system
- Photo / Lebenslauf personal-data blocks without explicit opt-in
- Non-English generation
- Auto-apply / ATS form fill
- Company-wide “always use this CV” library beyond package versions
- Interview Q&A deep packs (can ship as thin stub or J4.1)

### Explicitly never

- Inventing employers, dates, metrics, degrees, tools, or outcomes
- Inferring work authorization, citizenship, age, family status
- Flattened image CVs
- Sending without review
- Using disabled matching sources without user re-enable

---

## 3. Future enhancements

1. **PDF export** — HTML/CSS or `@react-pdf/renderer` from the same structured CV model  
2. **DOCX export** — `docx` package for editable Word  
3. **US / EU / UK / DACH template variants** — length, section labels, personal-data policy  
4. **Alternatives bank** — 2–3 positioning angles or opening paragraphs per pack  
5. **Company-only interest packs** — speculative outreach when no JD exists (client + jobs modes)  
6. **Attach to outbound email / proposal** — reuse Queue approval pattern  
7. **Outcome learning** — which emphasis correlated with replies/interviews  
8. **Portfolio PDF one-pager** — selected case studies as second attachment  
9. **Language localization** — DE/FR/NL letter tone when role language requires it  
10. **Diff vs base CV** — show what changed for this company

---

## 4. Required user and company data

### Required to generate (hard gate)

| Data | Source today |
|---|---|
| Approved `StructuredProfile` | `/profile` — `structured_profiles` status `approved` |
| Company name | Job or company record |
| User contact block for CV header | Name, email, location/timezone — must exist or be prompted |
| Package market choice | US \| Europe (confirmable) |

### Strongly recommended (soft warn, still generate)

| Data | Why |
|---|---|
| Job title + description / requirements | Primary targeting signal |
| Match explanation + gaps | Evidence for emphasis and honesty |
| Company research brief / snapshot | Credible “why this company” |
| ≥1 relevant project with outcomes | Concrete proof, not slogans |
| Skills + preferred employment types | Alignment language |
| Style / voice notes | Letter tone continuity with outreach |

### Optional

Education, certifications, notable clients, languages, GitHub/portfolio URLs, compensation (never put on CV unless user opts in).

### Company-only mode (no JD)

Minimum: company name + research brief (or manual “why interested” note). Soft-warn that specificity will be lower; frame as interest / speculative outreach pack, not job application.

---

## 5. Suggested screens and actions

| Screen / surface | Primary actions |
|---|---|
| Job card / Interested row | Prepare package · Open package |
| Package settings modal | Market · language · include photo? (EU, default off) · confirm sources |
| Package workspace `/applications/[id]` or `/interested/[jobId]/package` | Tabs: Analysis · CV · Cover letter · Evidence · Export |
| CV editor | Edit section · Regenerate section · Reorder emphasis · Restore from profile |
| Cover letter editor | Edit · Regenerate · Alternative A/B · Copy |
| Evidence panel | List cited projects/skills; flag inferences vs facts |
| Warnings banner | Missing JD, thin profile, market uncertain, gaps vs requirements |
| Approval bar | Approve package · Mark Prepared · Open job URL · Export |
| Interested / Applications lists | Status badges: none · draft · prepared · applied |

Reuse outreach patterns: draft vs final body, edit history, content-hash approval.

---

## 6. CV and cover-letter generation logic

### Pipeline

1. **Assemble corpus (deterministic)**  
   Approved profile JSON + enabled matching sources + job fields + match result + research brief. Strip disabled sources.

2. **Analysis pass (cheap/public or private mid-tier)**  
   Structured output: role summary, must-have vs nice-to-have, fit strengths, gaps, recommended market, recommended emphasis order, portfolio picks (IDs only).

3. **CV assembly (rules + LLM)**  
   - Rules pick candidates: projects/skills intersecting job keywords and match reasons.  
   - LLM rewrites **phrasing and order only** inside approved facts.  
   - Output: `TailoredCv` JSON (sections with bullets, each bullet tagged with `sourcePointers`).

4. **Cover letter (private Claude)**  
   150–250 words. Company-specific motive, 1–2 proof points, clear ask. No CV dump. Tone from style profile + market.

5. **Grounding validator (deterministic + light LLM check)**  
   Reject unknown employers/projects/metrics; reject degrees not in profile; label soft inferences (“likely ATS keywords from JD”) separately from facts.

6. **Human edit → approve**  
   Persist `bodyGenerated` / `bodyFinal` (or section-level equivalents) + hash.

### Evidence-based selection rules

- Prefer projects with outcomes over tool lists.  
- Cap CV to role-relevant experience; demote unrelated history to short lines or omit (with user visibility).  
- Never upgrade “used Figma” → “led design system at scale” without source text.  
- Gaps vs JD become warnings or honest letter framing — not fabricated coverage.

### Company without JD

- Emphasize company product/industry from research brief.  
- CV stays closer to “strong general senior profile” with industry tilt.  
- Letter explains interest and value hypothesis; avoids fake “for this role” claims.  
- Confidence badge: `low | medium` until a JD is attached (then offer regenerate).

---

## 7. US versus European adaptation rules

### Reliably supportable automatically

| Dimension | US | Europe (EN default) |
|---|---|---|
| Document name | Resume | CV / Curriculum Vitae |
| Target length | 1 page preferred; 2 max for senior | 2 pages OK for senior; avoid 4+ |
| Structure | Summary → Experience → Skills → Education | Profile → Experience → Skills → Education (projects may be stronger) |
| Photo | Never | Never by default |
| DOB / nationality / marital | Never | Never by default |
| Spelling | American (optimize, favor) | Prefer Oxford/international EN unless DE/UK locale set |
| Dates | Mon YYYY – Mon YYYY | Mon YYYY – Mon YYYY (same is fine) |
| Objective statement | Avoid; use professional summary | Short profile paragraph OK |
| References | “Available on request” omitted | Same; omit |
| Personal interests | Omit unless role-relevant | Omit unless role-relevant |
| ATS layout | Single column, standard headings | Same for EN applications |

### Require user confirmation

| Choice | Why |
|---|---|
| Market when company is remote/global or unclear HQ | Auto-suggest from job country / company.country / salary currency |
| Include postal address vs city/region only | Privacy |
| Include LinkedIn / portfolio / GitHub links | Already in profile — confirm set for this pack |
| German/DACH formal Lebenslauf extras | Out of EN MVP; if later, explicit opt-in for photo/personal data |
| Put availability or rate on CV | Almost always letter/form only |
| Language of letter when JD is non-EN | MVP: EN only + warn |

### Must never be inferred

Work authorization, visa needs, age, gender, family status, religion, health, salary history, unstated degree completion, inflated seniority, unverified metrics, employer “culture fit” claims without evidence.

---

## 8. Preview, editing, export, and versioning

### Preview

- **Source of truth:** structured `TailoredCv` + `CoverLetter` JSON/markdown.  
- **In-app preview:** React render that mirrors export styles (single-column, print CSS).  
- Do **not** preview from a rasterized image.  
- Show page-break hints for future PDF (approx. via CSS).

### Editing

- Section-level editors (summary, experience entries, skills, education, letter paragraphs).  
- Regenerate scoped to section with same grounding corpus.  
- Optional: store 2 model alternatives for summary/opening only.  
- Diff against previous approved version.

### Export (phased)

| Format | MVP | Phase 2 | Reliability |
|---|---|---|---|
| In-app preview | Yes | — | High |
| Plain text / Markdown | Yes | — | High — best for forms |
| PDF (selectable text) | No | Yes | High if HTML→PDF or react-pdf; avoid canvas screenshots |
| DOCX | No | Yes | Medium-high via `docx`; layout simpler than PDF |
| Image/PNG CV | Never | Never | Bad for ATS |

**Filename pattern:** `Lastname_Firstname_Company_Role_CV.pdf` (sanitize; no PII beyond name).

### Versioning

- `application_packages.version` increments on regenerate.  
- Keep last N versions (e.g. 5) + always retain last approved.  
- Approval stores content hash (mirror outreach drafts).  
- Exports freeze the approved snapshot (store file path or regenerate deterministically from snapshot).

---

## 9. Technical architecture and required services

### Reuse (already in Optra)

- `StructuredProfile` + profile sources + matching source toggles  
- Job match explanations + gaps  
- `CompanySnapshot` / `researchBriefs`  
- Private Claude routing (`draftMessage`-class tasks)  
- Draft edit / approve / hash patterns from outreach  
- Privacy export/delete + PUBLIC vs PRIVATE LLM split  
- Monthly AI budget hard stop  

### New modules (suggested)

```text
src/modules/applications/
  packages.ts          # create, generate, approve, version
  cv-model.ts          # TailoredCv schema
  cover-letter.ts
  grounding.ts         # validator
  export-text.ts       # MVP plain text
  export-pdf.ts        # phase 2
  export-docx.ts       # phase 2
  market.ts            # US/EU rules + suggestions

prompts/jobs/
  application-analysis.md
  tailored-cv.md
  cover-letter.md
```

### Data model (sketch)

```text
application_packages
  id, jobId?, companyId, profileVersionId
  market (us|europe), language
  state (draft|approved|prepared|superseded)
  analysisJson, cvJson, letterGenerated, letterFinal
  groundingJson, warningsJson
  contentHash, version, approvedAt
  createdAt, updatedAt

application_exports (phase 2)
  packageId, format (pdf|docx|txt), filePath, createdAt
```

Job triage: add `prepared` (or link package state) ahead of J5 full pipeline.

### Services / libraries

| Need | Recommendation |
|---|---|
| LLM writing | Existing Anthropic private path |
| Analysis structuring | Existing Gemini public path OK if corpus redacted |
| PDF (phase 2) | Prefer HTML + Playwright/Chromium print, or `@react-pdf/renderer` — selectable text required |
| DOCX (phase 2) | `docx` npm package |
| Storage | DB JSON for content; files under `data/application-packages/` like profile sources |
| Company research | Reuse; do not add paid research providers for MVP |

### ATS compatibility practices

- Single column; standard headings (`Experience`, `Education`, `Skills`)  
- No text-in-images, tables-for-layout, text boxes, icons-as-headings  
- System fonts or embedded licensed fonts with real glyphs  
- Semantic order matching visual order  
- Keywords from JD only when they map to real profile skills  
- Export plain text that matches PDF wording  

---

## 10. Risks, limitations, and unsupported cases

| Risk / case | Mitigation |
|---|---|
| Invented experience | Grounding validator + 0-tolerance metric; refuse generation if profile thin |
| Generic AI letter tone | Style profile + critique pass (reuse outreach quality checks) |
| No JD / vague company | Company-only mode with low-confidence badge; ask for “why interested” note |
| Remote multi-market roles | Force market confirmation |
| Non-EN JD | Warn; MVP generates EN only |
| Profile stale vs uploaded CV | Warn if source newer than approved profile |
| Budget overrun | Cap packs/day; idempotent regenerate; cheaper analysis model |
| Legal (misleading applications) | User owns final text; store audit of generated vs approved; no auto-send |
| EU personal-data CV norms | Default omit sensitive fields; opt-in only |
| PDF layout fragility | Defer PDF until content quality proven |
| Client-mode confusion | Separate copy: “application pack” (jobs) vs “intro pack” (clients) |

### Unsupported in MVP

- Auto-apply to Greenhouse/Ashby/Lever  
- Filling third-party forms  
- Generating design-portfolio PDFs from Figma  
- Claiming culture/mission fit without research evidence  
- Multi-user / recruiter-facing shared packs  

---

## 11. Estimated implementation complexity and ongoing cost

### Build effort

| Slice | Effort | Depends on |
|---|---|---|
| **A — Content MVP** (analysis + tailored CV JSON + letter + preview/edit/approve + plain text + grounding) | **6–10 days** | Approved profile + Interested jobs (J1/J3 done) |
| **B — PDF export** | **3–5 days** | Slice A stable |
| **C — DOCX + filename polish** | **2–3 days** | Slice B patterns |
| **D — Company-only mode + attach-to-email** | **3–5 days** | Slice A; Queue patterns |

Aligns with existing J4 estimate (5–8 days) for a notes+letter pack; Slice A is the honest upgrade (~+2 days for structured CV content).

### Ongoing AI cost (order of magnitude)

Assumptions: Claude Sonnet for CV+letter (~4–8k in / 2–4k out tokens), Gemini Flash for analysis.

| Volume | Est. cost / pack | Monthly |
|---|---|---|
| Light (10 packs) | ~$0.20–0.45 | ~$2–4.50 |
| Active (25 packs) | ~$0.20–0.45 | ~$5–11 |
| Regenerations | ~60–80% of full pack | Budget via version caps |

Fits Optra’s ~$8 monthly hard stop only with **active caps** (e.g. 15 packs/month or require confirm when budget >70%). Company research reuse avoids duplicate spend.

### Document generation cost

Local HTML/PDF/DOCX ≈ $0 infra on localhost. No third-party doc API required for MVP.

---

## 12. Clear recommendations — build vs do not build

### Build now (Slice A)

1. Interested → Prepare package flow  
2. Market confirm (US/EU)  
3. Grounded analysis + structured tailored CV + cover letter  
4. Preview, section edit, regenerate, approve  
5. Evidence map + missing-data warnings  
6. Plain-text export  
7. Prepared state; no auto-send  

### Build next (Slice B/C)

8. ATS-friendly PDF from the same structured model  
9. DOCX if you still edit outside the app often  

### Build later

10. Company-only interest packs  
11. Attach approved pack to personalized email/proposal  
12. Outcome-linked emphasis learning  
13. Non-EN / DACH formal variants  

### Do not build

- Image-based CVs  
- Auto-submit / ATS bots  
- Inferring personal/sensitive attributes  
- Multi-template design playground before content quality is proven  
- Separate product fork — extend Optra modules as planned  
- Replacing the approved profile with an unreviewed LLM rewrite as the new source of truth  

### Decision needed from you

1. Confirm **Slice A first** (content + plain text) vs pulling PDF into MVP.  
2. Confirm **Europe EN** as the single EU template for v1 (recommended).  
3. Confirm whether packages should live under **Interested detail** first, or wait for full **Applications** (J5) routes.

---

## Research answers (checklist)

| Question | Answer |
|---|---|
| Which US/EU conventions are reliable? | Length, naming, section order, omit photo/PII, ATS single-column, spelling — see §7 |
| Auto vs confirm? | Auto structure/terminology; confirm market, address detail, links, any EU personal data |
| Required info for credibility? | Approved profile + company + contact header; JD strongly recommended |
| Safe vs never infer? | Rephrase/reorder/select OK; never invent facts or sensitive attributes |
| Reliable exports/preview? | Structured JSON → React preview + plain text now; PDF/DOCX phase 2 |
| ATS preservation? | Real text, simple headings, keyword honesty, matching plain-text export |
| Useful without JD? | Yes, as interest pack with lower confidence — not default |
| Company-only behavior? | Research-tilt CV + speculative letter; prompt for motive; offer regen when JD appears |
| Privacy/retention? | PRIVATE model path; store packages as user data; include in export/delete; retention TBD (recommend keep approved packs, prune draft supersessions >90d) |
| Costs? | ~$0.20–0.45/pack; cap against $8 budget |
| Outside MVP? | PDF/DOCX, auto-apply, non-EN, photo Lebenslauf, inventing anything |

---

## Alignment with existing J4 plan

Current J4 deferred “Generated PDF CV files” and scoped “CV emphasis notes.” This proposal **keeps PDF deferred** but **promotes CV from notes → structured tailored content** because:

- Preview/edit/export of real CV text is the core user value requested.  
- Emphasis notes alone do not produce an attachable/pasteable artifact.  
- Structured content is the prerequisite for trustworthy PDF later — building notes first would be throwaway work.

If you prefer strict adherence to the original J4 checklist, ship letter + emphasis notes first (5–6 days), then immediately follow with structured CV (Slice A minus letter). Not recommended — combine them.
