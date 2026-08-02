# Optra — Complete UX Audit & Implementation Plan

**Date:** 2026-08-02  
**Scope:** `client-outreach/` (all authenticated app screens, auth, onboarding)  
**Methods:** SaaS UX/UI audit skill, Vercel React best-practices + shadcn guidance, Mobbin pattern research (adapted to Optra’s dual Jobs + Companies product)  
**Code foundations audited:** `page-shell.tsx`, `app-sidebar.tsx`, `app-topbar.tsx`, inbox/queue/profile/search/lead/learning/settings/admin/auth/onboarding components

---

## Product framing (what this audit optimizes for)

Optra is a private, single-user workspace with two related but distinct daily loops:

1. **Jobs** — find roles scored against an approved profile → shortlist (Interested) → apply externally → log outcomes (Improve).
2. **Companies** — discover hiring signals → research → confirm contact → draft/approve outreach → Queue → outcomes (Analytics / Improve).

The product already has strong primitives (`PageShell`, `Surface`, `EmptyState`, mode switch, match tiers). The main UX debt is **system inconsistency**: dual headers, mixed page chrome, duplicated cards, overloaded workspaces, and terminology that still mixes “leads,” “Voice,” and JSON ops into everyday flows.

---

# Part 1 — Product-wide UX system

## 1.1 Recommended container widths

| Layout token | Max width | Use for |
|---|---|---|
| `wide` | `1320px` (keep) | Today, Interested, Queue, Improve, Analytics, Admin overview |
| `workspace` | `1152px` (`max-w-6xl`) | Profile review, Search criteria, Lead detail |
| `form` | `672px` (`max-w-2xl`) | Voice settings, auth forms, short single-purpose forms |
| `full` | none | Never as default; only Admin credential paste if needed |

**Rules**

- Same purpose → same width. List/triage screens always `wide`. Setup/edit screens always `workspace` or `form`.
- Do not override `PageShell` default `gap-12` with ad-hoc `gap-5` / `gap-6` / `gap-8` per page. Use the spacing scale below.
- Content alignment: left-aligned inside the shell; never center long task UIs.

## 1.2 Page layout rules

```
┌──────── 240px sidebar ────────┬──────── content column ────────┐
│ Brand                         │ Topbar (context only)          │
│ Daily / Setup / System        │────────────────────────────────│
│                               │ PageHeader (title once)        │
│                               │ Toolbar / filters              │
│                               │ Primary content (Surface)      │
└───────────────────────────────┴────────────────────────────────┘
```

1. **One title owner:** either Topbar *or* `PageHeader`, not both. Recommended: Topbar keeps route context (short); page body uses `PageHeader` only when the page needs description + primary actions. For list pages, demote Topbar to breadcrumb-style context and keep the large title in the page — **or** keep Topbar title and remove in-page H1. Pick one product-wide.
2. **Recommended decision:** Keep **page-level `PageHeader`** as the canonical title (34px display). Change Topbar to show only utilities (budget, account) + optional tiny breadcrumb, not a duplicate H1.
3. **No breadcrumbs** on primary nav destinations (Today, Queue, Profile…). Use breadcrumbs only on nested detail: `Today · Companies / {Company}`.
4. **Primary action** lives in `PageHeader` actions (right). Filters live in a toolbar under the header.
5. **Section spacing** between major regions: `32px` (`gap-8`). Inside a `Surface`: `24px`. Related controls: `16px`.

## 1.3 Spacing rules

| Token | Value | Use |
|---|---|---|
| micro | 4px | icon–label |
| tight | 8px | chip gaps |
| control | 16px | sibling controls |
| group | 24px | groups inside panels (`PanelBody`) |
| section | 32px | header → content, section → section |
| page | 40–48px | page vertical padding (`py-10` / `lg:py-14` — keep) |
| page-x | 32px / 48px | `px-8` / `lg:px-12` — keep |

Flag any hardcoded `gap-5` (20px) or mixed `py-3`/`py-4` on equivalent cards.

## 1.4 Action hierarchy rules

| Level | Visual | Placement | Examples |
|---|---|---|---|
| Primary | `Button` default/`size="lg"` — one per region | Header right, or empty-state CTA | Find jobs, Approve profile, Save settings, Approve to queue |
| Secondary | `outline` or `secondary` | Near primary or toolbar | Refresh, Add company, Save draft |
| Tertiary | `ghost` / text link | Inline, row, overflow | Open posting, Hide advanced |
| Destructive | `destructive`, separated | After safe actions; confirm for irreversible | Not interested, Delete source, Suppress |

**Hard rules**

- Max **one** solid primary button in the page header.
- If a region has >3 peer actions, move extras into a “More” menu (add `DropdownMenu` from shadcn — currently missing).
- Destructive never sits left of the primary action.
- Sticky footer actions only for long forms (Profile approve, Voice save, Lead approve).

## 1.5 Shared component rules

| Pattern | Canonical component | Do not |
|---|---|---|
| Page chrome | `PageShell` + `PageHeader` | Mix `SectionTitle` as page title |
| Section inside page | `SectionTitle` (h2) | Use `PageHeader` inside panels |
| Card/panel | `Surface` + `PanelHeader`/`PanelBody` | Use `Card` except inside Lead compose editor if needed — then migrate Lead to `Surface` |
| Empty | `EmptyState` | One-off centered copy blocks |
| Status | `StatusPill` / `Badge` | Ad-hoc colored spans |
| Match / Fit score | Single `ScoreBadge` (new shared) | Three local score UIs |
| Match insights | `JobMatchInsights` (chips + decision card + Sheet) | Wall of “Why it matches” bullets |
| Job row | Single `JobListItem` (extract) | Duplicate Interested vs Today cards |
| Segmented tabs | Shared `SegmentedControl` | Copy-pasted `role="tablist"` blocks |
| Progress modal | `SearchProgressModal` | New search overlays |
| Alerts | Shared `InlineAlert` (error/success/info) | Raw `<p className="border-destructive…">` |

**New component justification**

| Proposed | Why existing is insufficient |
|---|---|
| `ScoreBadge` | Today uses `MatchPill`, Interested uses a smaller score chip, Companies uses `FitScore` — same concept, three APIs. |
| `JobListItem` | Today and Interested duplicate expand/collapse + actions with drift. |
| `SegmentedControl` | 5+ identical tablist implementations with slightly different padding/colors. |
| `InlineAlert` | Error/success banners reimplemented on every client page. |
| `Tooltip` (shadcn) | Only native `title=` today — inaccessible, unstyled, weak copy. |
| `Sheet` / mobile nav | No responsive nav; sidebar is fixed 240px. |
| `DropdownMenu` | Lead + job rows need overflow for tertiary actions. |
| `StickyFormActions` | Profile/Voice/Lead long forms bury Save/Approve. |

Do **not** invent a second card system, a dashboard widget kit, or a new nav paradigm.

## 1.6 Form rules

- Labels above fields; helper text under labels (not only under inputs).
- Default field width: full column inside `form` / `workspace` shell.
- Two-column only for short paired fields (min/max pay, first/last).
- Progressive disclosure: hide Advanced (JSON, ATS boards, Apify caps) behind “Advanced”.
- Never expose raw JSON to the default Voice path — use structured fields (see Settings audit).
- Sticky primary save on long forms; disabled until dirty when feasible.
- Required fields marked; errors inline under the field + summary alert at top.

## 1.7 Table and list rules

Optra is mostly **card lists**, not data tables. Rules:

1. Toolbar: Search (if any) → filters/segments → count meta → secondary utilities. Primary create/find stays in header.
2. Cards share: title, meta line, score badge right, expand for detail + actions.
3. Collapsed row: enough to decide; expanded: reasons + actions.
4. Queue stays as dense rows (email queue pattern) — OK to differ from job cards.
5. Empty states always offer the single next action.

## 1.8 Modal / drawer / popover rules

| Pattern | Use |
|---|---|
| Modal | Blocking async work (`SearchProgressModal`), destructive confirm |
| Drawer/Sheet | Mobile nav; optional lead quick-view later |
| Popover | Filters, budget detail |
| Tooltip | Icon-only, scores, disabled why, jargon |
| Inline expand | Default for job/company triage (keep) |

- Modals must trap focus, have Cancel, and not rely on overlay-click alone for destructive flows.
- Do not nest modals.

## 1.9 Tooltip and helper-text rules

- **Helper text** = needed before acting (form fields, empty states, tab explanations).
- **Tooltip** = optional clarification (scores, icon buttons, disabled reasons, gates).
- Never put task-critical info only in a tooltip.
- Prefer one sentence; no label echo.

Exact copy is listed per screen in Part 2.

## 1.10 Responsive rules

| Breakpoint | Behavior |
|---|---|
| `< lg` | Sidebar becomes Sheet (hamburger in Topbar). Content `px-4`/`px-6`. |
| `lg+` | Current 240px sticky sidebar. |
| Touch | Min 44px targets for primary triage actions. |
| Job/company cards | Stack score under title on narrow widths; actions wrap with primary first. |
| Lead workspace | Single column under `lg`; research snapshot above compose. |

**Critical gap today:** `AppSidebar` is always `w-[240px]` with no mobile alternative — content is crushed on phones.

## 1.11 Terminology (product glossary)

| Use | Avoid |
|---|---|
| Jobs / Companies (Today modes) | Mixing “leads” in user-facing Today copy |
| Company (detail) | Lead (OK in Admin/ops only) |
| Match score (jobs) | Fit (reserve for companies) |
| Interested | Saved (jobs) — “Save” means “back to Today / later” |
| Queue | Outbound board |
| Profile | Style profile / profile_md for matching |
| Voice | Settings (nav label can stay Voice; page title “Outreach voice”) |
| Search | Search criteria |
| Improve | Learning |
| Find jobs / Find companies | Run pipeline / Run daily |

---

# Part 2 — Screen-by-screen audit

---

## 2.1 Welcome / Auth (login, signup, forgot, reset)

**Screens:** `/welcome`, `/login`, `/signup`, `/forgot-password`, `/reset-password`  
**Primary user goal:** Enter or create the private workspace.  
**Primary action:** Continue / Log in / Create account / Send reset link.

### Current UX problems
- Auth shell is comparatively polished; main risk is inconsistency with in-app density and missing mobile panel (panel hidden `<lg` — acceptable).
- Ensure error states and password rules use the same `InlineAlert` language as the app.

### Layout / components
- Uses `AuthShell` (form column + product panel) — good; keep as the `form`-width pattern for unauthenticated flows.
- Do not introduce app sidebar here.

### Recommended structure
Keep split layout. One primary CTA per form. Link secondary paths as text.

### Tooltips / helpers
- Password field helper: “At least 8 characters. You’ll use this only on this device’s Optra account.”
- No tooltip on Log in.

### Mobbin patterns
- Remote / Mercor onboarding modals: one clear CTA, short benefit line ([Remote profile flow](https://mobbin.com/flows/39eb4c69-a3fe-4f3e-8200-bbd67966b575)).
- Auth split panels (already Clay/Greptile-inspired in code comments) — keep.

### Reusable components
`AuthShell`, `AuthBrand`, shared form field + `InlineAlert`.

### Priority
**Medium** (polish + shared alerts)

---

## 2.2 Onboarding wizard

**Screen:** `/onboarding`  
**Primary user goal:** Approve Profile + Search so Today can find jobs.  
**Primary action:** Step-dependent — Continue → Approve profile → Approve search → Go to Today.

### Current UX problems
- Embeds full `ProfileWorkspace` / `SearchCriteriaWorkspace` — high cognitive load for a first-run path (Remote/Mercor use one-task-per-step).
- Continue disabled messaging competes with in-workspace Approve buttons (two “gates”).
- Progress stepper is good; welcome/done centering vs wide workspace is intentional — keep, but tighten profile/search steps to essentials only.

### Layout
- `max-w-5xl` / `max-w-6xl` — align with `workspace` token.
- Onboarding should use **simplified variants** (`variant="onboarding"` already exists on Profile — extend: hide Advanced, GitHub optional, one primary Approve).

### Recommended simplified structure
1. Welcome (value + what you’ll do in 3 steps)
2. Profile essentials only (CV/LinkedIn/notes → extract → essentials tab → Approve)
3. Search essentials (titles, locations, exclusions) → Approve
4. Done → primary “Find jobs on Today”

### Tooltips / helpers
- Stepper “Search”: “Defines which job boards and titles Optra scans — you can edit anytime.”
- Approve disabled: “Review the draft fields above, then click Approve profile.”

### Mobbin
- [Remote candidate profile creation](https://mobbin.com/flows/39eb4c69-a3fe-4f3e-8200-bbd67966b575): one question per step, Skip secondary, Continue primary.
- [Mercor completing profile](https://mobbin.com/flows/f824d604-8f91-4e6b-bd03-cf2d8efc0cd4): checklist on home after — maps to existing `SetupChecklistBanner`.

### Reusable
Onboarding `StepFrame`, slim profile/search embeddings, shared stepper.

### Priority
**High**

---

## 2.3 Today (Jobs + Companies)

**Screen:** `/`  
**Primary user goal:** Review today’s matches and act (Interested / reject / accept company).  
**Primary action:**  
- Jobs (no criteria): **Set search criteria**  
- Jobs (ready, empty): **Find jobs**  
- Jobs (has rows): still **Find jobs** as refresh-primary OR demote to Refresh when list non-empty  
- Companies: **Find companies** (currently weaker — Refresh ghost / Add company outline)

### Current UX problems
1. **Double chrome:** Topbar “Today” + in-page “Today · Jobs/Companies”.
2. Mode switch is excellent (labeled purpose) but Companies primary CTA is weaker than Jobs.
3. Jobs: five expanded actions compete (Interested, Save, Already applied, Open posting, Not interested).
4. Match band tabs + long helper paragraph + fallback banner can stack into noise.
5. Setup checklist + mode switch + section title = three competing “starts”.
6. Companies `FitScore` title attribute is weak (“Fit score”).
7. Discover controls toggled by “Add company” — good progressive disclosure; keep.

### Layout inconsistencies
- Uses `PageShell` `wide` with `gap-6` override (should be section scale).
- Jobs uses `SectionTitle`; Interested uses `PageHeader` — inconsistent sibling.

### Component inconsistencies
- Score UI ≠ Interested score UI.
- Companies filter tabs (All / To review / Saved) ≠ Jobs match tabs (Strong / Worth a look / All) — OK functionally, but both should use `SegmentedControl`.

### Recommended simplified structure
```
[SetupChecklist if incomplete]
[Mode switch: Jobs | Companies]
[PageHeader: title + one primary]
[Segmented filters]
[Optional one-line meta]
[Card list | EmptyState]
```

**Action hierarchy (job card expanded)**  
Primary: **Interested**  
Secondary: Open posting  
Tertiary overflow: Save for later, Already applied  
Destructive: Not interested (with reason chips)

When list has items, header primary becomes **Refresh jobs** (`outline`), not a second giant Find.

### Match insights (AI “why it matches”) — decided

Do **not** show match rationale as a wall of bullets. Do **not** use a modal for triage.

**Hybrid pattern (shipped in `JobMatchInsights`):**

1. **Collapsed card** — `Remote · OK / Unclear / No` (+ TZ chip when known). Opens rationale Sheet.
2. **Expanded card** — Remote decision card first (“Can you work remote?”), then max 3 labeled match rows (`Label: evidence`), then amber “Things to watch”, link to **Full rationale**.
3. **Sheet (slide-in)** — full remote verdict (policy / geo / TZ / evidence), all match reasons, concerns, `mainRisk`, missing requirements + Interested / Open posting.

**Data:** match prompt `@v3` returns structured `remoteFit` in `scoreJson`. Older matches fall back to `deriveRemoteFit()` from `remotePolicy` + concerns.

Remote is a hard preference gate when search criteria have `remoteRequired` — never bury it only in prose concerns.

### Exact tooltip / helper copy
- Match score badge: “How closely this role matches your approved profile — skills, seniority, location, and preferences. 70+ is Strong; 55–69 is Worth a look.”
- Worth a look tab: helper (persistent): “Weaker or ambiguous fits. Check remote chips and ‘Things to watch’ before you apply.”
- Companies Fit badge: “How well this company fits outreach — need, timing, and your positioning. Not a job match score.”
- Disabled mode switch while searching: “Stay on this page until the search finishes.”
- Save (jobs): tooltip “Keep on Today for later — not the same as Interested.”
- Remote chip: summary from `remoteFit.summary` (title attribute).

### Mobbin
- [Contra / Employment Hero / Glassdoor job lists](https://mobbin.com/screens/0261bdc3-e4cc-4e5f-baf2-28dabece24a8): clear list hierarchy, score/meta secondary to title.
- [Linear sidebar + dense main](https://mobbin.com/screens/46088879-314c-405c-88b5-eb7820c05efb): one primary region, quiet utilities.
- Mercor Explore: search + filters + cards — adapt density, don’t copy purple marketing chrome.
- [Remote timezone chips](https://mobbin.com/screens/6fb1ee0f-90ec-4e96-b0bb-2f76b5673f9d): remote policy as status pill, not body prose.
- [Workable match criteria](https://mobbin.com/screens/500e1316-bcaf-4ad2-836c-96d8ffdc71b4): check/X dimensions vs paragraphs.
- [Braintrust location/TZ meta](https://mobbin.com/screens/ba4d9aa8-c1bf-4b37-a605-ae1365b507ef): overlap as first-class field.

### Reusable
`ScoreBadge`, `JobListItem`, `JobMatchInsights`, `SegmentedControl`, unify Find/Refresh patterns with Companies.

### Priority
**Critical**

---

## 2.4 Interested

**Screen:** `/interested`  
**Primary user goal:** Manage roles you want to pursue; open posting / mark applied.  
**Primary action:** **Mark applied** (per row when expanded); page-level: none (or “Back to Today” only when empty).

### Current UX problems
- Reimplements job card instead of sharing `JobListItem`.
- Score presentation differs from Today (no tier labels).
- “Move to Today” label is clearer than Today’s “Save” — **standardize on “Save for later” / “Move to Today”** depending on context.
- Uses `PageHeader` (good) while Today uses `SectionTitle` (inconsistent).
- Reject without reason chips (Today has chips) — align.

### Recommended structure
Same card as Today; actions: Mark applied (primary), Open posting, Save for later → Today, Not interested.

### Tooltips
- Mark applied: “Removes it from Interested and records that you already applied outside Optra.”

### Mobbin
Saved-items patterns (Peerlist/Braintrust referenced in code) — keep list + empty CTA to Today.

### Priority
**High**

---

## 2.5 Queue

**Screen:** `/queue`  
**Primary user goal:** Review pending drafts and monitor scheduled/sent/failed mail.  
**Primary action:** Context-dependent — **Review** on pending rows; header: Pause/Resume via `QueueControls`.

### Current UX problems
- Header description packs policy metrics into one dense line — hard to scan.
- Health strip + tabs + events toggle is fine; “Keychain credentials” is ops jargon for the default user.
- Uses `SectionTitle` not `PageHeader`.
- Failed tab and delivery events are advanced — good that events are collapsed.

### Recommended structure
```
PageHeader: Queue | [Pause/Resume]
Status chip row: Mailbox · Sent today · Remaining (plain language)
Segmented: Pending | Scheduled | Sent | Failed
List rows with one row primary (Review)
```

### Tooltips / helpers
- Remaining today: “How many new outreach emails Optra will still send today under your send limits.”
- Paused: “Sending is stopped. Resume only when the mailbox issue is fixed.”
- Replace “Keychain credentials” → “Mailbox connected” / “Mailbox not connected — add credentials in Admin.”

### Mobbin
- [GoDaddy campaigns tabs](https://mobbin.com/screens/23f8f983-11c4-4bd2-a926-777ad16ed7ba): All / Scheduled / Drafts / Sent + clear create primary.
- [Shopify Email overview](https://mobbin.com/screens/ff96a48e-c3ec-43e4-a70d-01b25916562e): drafts vs campaigns separation; keep Optra simpler (no template gallery).

### Priority
**High**

---

## 2.6 Company / Lead workspace

**Screen:** `/leads/[id]`  
**Primary user goal:** Move one company through review → contact → compose → approve → outcome.  
**Primary action:** Stage-dependent — Accept → Confirm contact → Generate draft → Approve to queue.

### Current UX problems
1. **Critical complexity:** Many equal-weight buttons (Generate, Generate + critique, follow-ups, MX check, harvest, patterns, suppress, etc.).
2. Uses `Card` system instead of `Surface` — visual island vs rest of app.
3. Stage stepper helps, but `stageOverride` + approve mode adds state complexity users feel as unpredictability.
4. Research + contacts + compose on one scrolling page without sticky primary.
5. Policy/score jargon without tooltips.
6. No breadcrumb back to Today · Companies.

### Recommended simplified structure
```
Breadcrumb: Today · Companies / {Name}
Header: company + ScoreBadge + StatePill | stage primary only
Stepper (Review → Contact → Compose → Approve → Outcome)
Main: stage panel
Aside (lg): Company snapshot (research compact)
Advanced disclosure: Harvest, MX, patterns, suppress, critique
```

**Per-stage single primary**
- Review: Accept  
- Contact: Save contact / Confirm  
- Compose: Generate draft (critique behind Advanced)  
- Approve: Approve to queue  
- Outcome: Mark replied (or next outcome)

### Exact tooltip copy
- Score dimensions (needNow, fit, etc.): plain-language definitions, e.g. Need now — “Evidence the company is hiring or actively needing help soon.”
- Generate + critique: “Writes a draft, then runs an extra quality check (uses more AI budget).”
- Confidence on contact: “How sure we are this email reaches a real person. Confirm manually when you can.”
- Suppress: “Never suggest this company again.”

### Mobbin
- Prefer **Twenty / Attio** calm detail ([Twenty company](https://mobbin.com/screens/9b44870a-3ed2-4dbb-87c0-f62eb70f5ec4), [Attio company](https://mobbin.com/screens/7dea1a05-efa7-4eac-ab37-b0e06e9431d0)): identity + one compose CTA + details side panel.
- Avoid HubSpot/Apollo density for Optra’s single-user scope.

### Reusable
Migrate to `Surface`; `StickyFormActions`; `DropdownMenu` for advanced; shared `InlineAlert`.

### Priority
**Critical**

---

## 2.7 Profile

**Screen:** `/profile`  
**Primary user goal:** Ingest sources → review draft → approve matching profile.  
**Primary action:** **Approve profile** (when draft ready); else **Generate draft** / add source.

### Current UX problems
- Powerful but long; Advanced/projects compete with Essentials.
- Page uses `SectionTitle` + badges in meta — should be `PageHeader`.
- Width `lead` is correct; gap overrides inconsistent.
- Portfolio matching toggle needs clearer helper (exists partially).
- Onboarding and Profile share workspace — good; ensure Advanced stays collapsed by default.

### Recommended structure
```
PageHeader: Profile | status badges | Approve (sticky secondary bar when draft dirty)
Sources strip (compact)
Tabs: Essentials | Skills | Job prefs | More
Sticky footer: Save draft · Approve profile
```

### Tooltips / helpers
- Approved badge: “Matching and job search use this version until you approve a newer draft.”
- Use portfolio in matching: “When on, portfolio projects influence match scores. Turn off if the portfolio is outdated.”
- Compensation: keep persistent helper (already good).

### Mobbin
- [Mercor Profile tabs](https://mobbin.com/flows/7381ed73-1aad-467c-90d5-b175c2e09c3b): tabbed profile, helper under labels.
- [Twenty settings profile](https://mobbin.com/screens/0e7f4b98-3525-48ed-955a-76d2ecef325d): section + helper + controls — adapt for review/approve, not auto-save only.

### Priority
**High**

---

## 2.8 Search criteria

**Screen:** `/search-criteria`  
**Primary user goal:** Generate/edit/approve the job search profile.  
**Primary action:** **Approve criteria** (or Generate if empty).

### Current UX problems
- Also offers **Find jobs** — steals Today’s primary loop and duplicates pipeline entry points.
- Advanced fields (Apify $, max raw, boards) visible too early for many users.
- Rationale list is useful — keep near approve.
- Embedded onboarding auto-generate is good.

### Recommended structure
- Header primary: Approve / Generate only.
- Secondary: “Find jobs” link button → navigates to Today and triggers search there (or deep-link), not a second pipeline UI.
- Advanced collapsed by default.

### Tooltips
- Posted within: “Only consider jobs first seen in this many hours.”
- Max Apify spend: “Hard cap on paid job-board scraping for the day. Search stops when reached.”
- Excluded titles: “Roles Optra should drop before scoring (e.g. junior, pure brand).”

### Mobbin
Remote location/preferences steps — one cluster of fields, Continue primary ([flow](https://mobbin.com/flows/39eb4c69-a3fe-4f3e-8200-bbd67966b575)).

### Priority
**High**

---

## 2.9 Improve (Learning)

**Screen:** `/learning`  
**Primary user goal:** Log outcomes and approve suggested search/style/scoring updates.  
**Primary action:** Approve/reject proposal (when present); else log job outcome / generate insights.

### Current UX problems
- Jobs vs Clients mode switch duplicates Today’s mental model — necessary but must share `LearningModeSwitch` styling with Today’s switch (currently different).
- Gate badges (`days 3/30`, `edits 2/20`) are opaque without tooltips.
- Clients hub tabs vs Jobs hub tabs use different taxonomies (Sources/Suggested/Reports vs Results/Suggested/Versions) — OK if labeled clearly.
- Analytics overlap: reply funnel lives on Analytics AND learning sources.

### Recommended structure
- One mode switch component shared with Today styling.
- KPI row with tooltips.
- Default tab: Suggested if pending > 0.
- Defer raw gate numbers into tooltip/helper.

### Exact tooltip copy
- Gathering/Ready: “Optra waits for enough sent mail and edits before suggesting style changes, so recommendations aren’t random.”
- days N/30: “Days with outreach activity toward the suggestion threshold.”
- Adaptive ranking toggle: “When on, recent outcomes gently re-order job results. You still approve search-criteria changes.”

### Mobbin
Uxcel “getting started” checklist + clear primary ([Uxcel flow](https://mobbin.com/flows/3eab9369-f8c7-476c-86e5-5162f39ac4e7)) — for empty Improve state.

### Priority
**High**

---

## 2.10 Voice (Settings)

**Screen:** `/settings`  
**Primary user goal:** Shape outreach writing voice and send volume.  
**Primary action:** **Save settings**.

### Current UX problems
1. **Critical:** Target filters / country policy / send policy as **raw JSON textareas** — unacceptable for the default path.
2. Nav label “Voice” vs page “Outreach voice” vs form still saving `profileMd` — clarify vs Profile.
3. Budget + daily company count belong nearer Admin or a “Preferences” group — OK on Voice if labeled “Outreach volume”.
4. No sticky save; long page.
5. Success “Saved.” is easy to miss — use toast or `InlineAlert` success.

### Recommended structure
```
PageHeader: Outreach voice
Surface: About you for emails
Surface: Writing style (do/don’t, examples)
Surface: Send volume (daily companies, max/day, weekdays) — structured fields
Advanced: Country policy as selects/chips, not JSON
Admin-only: raw JSON escape hatch
Sticky: Save settings
```

### Helpers
- About you: “Short positioning used in cold emails. This is not your job-matching Profile.”
- Examples: “Paste 3–5 emails you like. Separate with a line that only contains ---.”

### Mobbin
- [Clerk unsaved changes bar](https://mobbin.com/screens/bceecfc6-3efc-4ef5-a682-54f7ede1dae5): sticky Save/Reset.
- [Origin settings](https://mobbin.com/screens/04c5e73d-0ccc-4a9d-b501-2a5635abbda3): sectioned form, disabled Save until dirty.

### Priority
**Critical**

---

## 2.11 Analytics

**Screen:** `/analytics`  
**Primary user goal:** See outreach funnel health at a glance.  
**Primary action:** None operational — secondary **Improve**; empty → **Go to Today**.

### Current UX problems
- Jobs mode has no analytics surface — funnel is companies-only while product is dual-mode.
- KPI labels lack definitions (Reply rate especially).
- Pipeline state keys shown raw (`saved_for_later`) — need human labels.
- Draft quality badges are cryptic (`avg edit 12%`).
- Overlaps Admin state counts and Improve sources.

### Recommended structure
- Mode awareness: Jobs metrics (interested → applied → reply) vs Companies funnel — or rename page “Outreach analytics” and link Jobs outcomes to Improve.
- KPI tooltips; humanize states via `labelPolicy` / shared labels.
- Remove duplicate “Improve” if sidebar already exposes it — keep as contextual CTA when reply rate low.

### Tooltips
- Reply rate: “Replies divided by emails sent. Small samples swing wildly.”
- Major rewrite rate: “Share of drafts you heavily rewrote before sending — high means Voice needs work.”

### Priority
**Medium**

---

## 2.12 Admin

**Screen:** `/admin`  
**Primary user goal:** Credentials, budget, run health, privacy ops.  
**Primary action:** Fix missing credentials (first) / complete readiness checklist.

### Current UX problems
1. **Overloaded kitchen sink** — credentials, run stats, funnel, rejects, readiness, privacy on one scroll.
2. Uses `PageHeader` (good) but inner panels use full `SectionTitle` like page titles.
3. Funnel/reject blocks duplicate Analytics.
4. Validation readiness is expert-only — collapse by default.
5. No single “what should I do now?” beyond counting action items (the list helps — promote it).

### Recommended structure
```
PageHeader + action items callout (if any)
Row: Credentials | Budget | Latest run
Surface: API keys
Surface: Privacy export
<details Advanced>: Run stats, lead states, rejects, validation readiness
```
Move lead-state analytics exclusively to Analytics.

### Tooltips
- AI budget card: “Estimated LLM spend this month. Hard stop blocks new AI calls when reached.”
- Readiness phases: “Internal checklist before trusting outreach quality — not required for Find jobs.”

### Priority
**High** (simplify information architecture)

---

## 2.13 Cross-cutting: Topbar + Sidebar + Empty/Loading/Error

### Topbar
- Duplicate titles with page headers — **Critical** consistency issue.
- Budget pill `title=` is weak; use Tooltip with spend + hard-stop explanation.
- Log out icon-only — OK with `sr-only` (present); add Tooltip “Log out”.
- No mobile menu control — **Critical**.

### Sidebar
- Grouping Daily / Setup / System is strong ([Linear](https://mobbin.com/screens/46088879-314c-405c-88b5-eb7820c05efb)-like).
- Counts on Today/Interested/Queue — good.
- “Voice” may confuse next to “Profile” — helper on first visit or rename to “Voice & send” in description only.
- Fixed width, no collapse — **Critical** for responsive.

### Empty / loading / error / success
- `EmptyState` is solid and reused — standardize all pages on it.
- Loading: search uses modal (good); other transitions only disable buttons — add aria-busy on lists.
- Error: standardize `InlineAlert`.
- Success: toast or alert; avoid relying on ephemeral “Saved.” text only.
- Skeleton: missing for Today list refresh — optional Medium.

---

# Part 3 — Synthesis

## 3.1 Most important product-wide inconsistencies

1. **Duplicate page titles** (Topbar H1 + PageHeader/SectionTitle).
2. **`PageHeader` vs `SectionTitle`** used interchangeably as page titles.
3. **`Surface` vs `Card`** (Lead workspace visually “other product”).
4. **Three score components** (MatchPill / Interested chip / FitScore).
5. **Duplicated job cards** (Today vs Interested).
6. **Primary CTA strength** differs Jobs vs Companies on Today.
7. **JSON settings** in Voice vs structured Profile elsewhere.
8. **No mobile navigation** pattern.
9. **Terminology drift** (lead/company, Save/Interested, Voice/Settings, Fit/Match).
10. **Analytics vs Admin vs Improve** overlapping metrics.

## 3.2 Proposed unified page & container system

| Screen type | Shell width | Title | Header actions | Body |
|---|---|---|---|---|
| Triage list | `wide` | `PageHeader` | Find/Refresh | Segmented + cards |
| Email queue | `wide` | `PageHeader` | Pause/Resume | Status + segmented + rows |
| Setup workspace | `workspace` | `PageHeader` | Approve / Generate | Tabs + sections + sticky footer |
| Narrow settings | `form` | `PageHeader` | — (sticky save below) | Surfaces |
| Detail | `workspace` | `PageHeader` + breadcrumb | Stage primary | Main + aside |
| System admin | `wide` | `PageHeader` | — | KPI row + essentials + advanced |

Topbar: utilities only (budget, account, mobile menu). No duplicate H1.

## 3.3 Components to standardize or merge

| Merge into | From |
|---|---|
| `ScoreBadge` | `MatchPill`, Interested score span, `FitScore`, `ScoreMark` |
| `JobListItem` | `jobs-inbox` JobCard, `interested-jobs` row |
| `SegmentedControl` | Today mode extras, match tabs, queue tabs, learning tabs, triage filters |
| `InlineAlert` | All error/message `<p className="border-destructive…">` |
| `PageHeader` only for pages | Replace page-level `SectionTitle` on Queue, Analytics, Learning, Profile, Search, Voice, Today |
| `Surface` everywhere | Replace Lead `Card` chrome |
| shadcn `Tooltip`, `DropdownMenu`, `Sheet` | Missing primitives |

## 3.4 Screens to simplify, combine, redesign

| Screen | Action |
|---|---|
| Today | Simplify actions; unify Companies primary; fix title chrome |
| Lead workspace | **Redesign** interaction density (not visual theme chase) |
| Voice | **Redesign** JSON → structured controls |
| Admin | **Simplify** — split advanced ops |
| Analytics | Clarify scope; humanize; optional jobs slice |
| Improve + Analytics | Keep separate; remove duplicate source tables from Admin |
| Interested | Merge card component with Today |
| Onboarding | Slim embedded workspaces |
| Profile / Search | Sticky approve; demote Find jobs from Search |

**Do not remove** Queue, dual Today modes, or approve gates — they are core trust mechanics.

## 3.5 Quick UX improvements (≤ 1–2 days each)

1. Remove duplicate H1 from Topbar (or from pages) — pick one.
2. Standardize all pages onto `PageHeader`.
3. Companies Today: primary **Find companies** `size="lg"` mirroring Jobs.
4. Job card: overflow menu for tertiary actions; Interested = primary.
5. Replace weak `title="Fit score"` with real tooltip copy (after adding Tooltip).
6. Humanize Analytics state keys.
7. Voice: hide JSON behind Advanced; add helper clarifying vs Profile.
8. Search: remove direct Find jobs primary; link to Today.
9. Budget pill tooltip copy.
10. Empty/error → always `EmptyState` / shared alert.

## 3.6 Larger structural improvements

1. Responsive shell: `Sheet` sidebar + top menu button.
2. Extract `JobListItem` + `ScoreBadge` + `SegmentedControl`.
3. Lead workspace stage simplification + Advanced disclosure + Surface migration.
4. Voice structured send/country policy fields; sticky save.
5. Admin information architecture (essentials vs advanced).
6. Dual-mode Analytics or rename + Jobs outcome summary.
7. Design-system pass: add shadcn Tooltip, DropdownMenu, Sheet, Toast.
8. Onboarding essentials-only path.
9. Shared sticky form action bar.
10. Terminology pass across nav, headers, pills, emails.

## 3.7 Prioritized implementation plan

### Phase A — Foundation (Critical) — ~3–5 days
1. Title system decision + Topbar utilities-only.
2. `PageHeader` standardization + spacing token pass on `PageShell`.
3. Add shadcn `Tooltip`, `DropdownMenu`, `Sheet`, toast.
4. Mobile nav Sheet.
5. `InlineAlert` + replace ad-hoc banners.
6. Today Companies primary CTA parity + job action hierarchy.

**Exit:** Every primary screen shares chrome; usable on mobile width; one H1.

### Phase B — Core loops (Critical/High) — ~5–7 days
1. `ScoreBadge` + `JobListItem` extraction; Interested reuse.
2. `SegmentedControl` extraction.
3. Lead workspace simplification (stage primaries, Advanced, Surface, breadcrumb).
4. Search: demote Find jobs; Advanced collapse.
5. Voice: structured fields; sticky save; JSON advanced/admin.

**Exit:** Jobs triage and company outreach feel like one system; no JSON in default Voice.

### Phase C — Setup & learning (High) — ~3–4 days
1. Profile sticky approve + clearer status.
2. Onboarding slim variants.
3. Improve tooltips + shared mode switch styling.
4. Analytics humanization + scope clarity.
5. Admin simplify (move duplicates, collapse readiness).

**Exit:** Setup and feedback loops scannable in under a minute.

### Phase D — Polish (Medium/Low) — ~2–3 days
1. Skeletons for Today refresh.
2. Toast successes app-wide.
3. Copy glossary enforcement.
4. Keyboard focus audit on modals/menus.
5. Optional jobs metrics on Analytics.

## 3.8 Acceptance criteria

The UX refinement is done when:

1. **One H1 per page**; Topbar does not duplicate page title.
2. All app pages use **`PageShell` + `PageHeader`** with the width table above — no arbitrary max-width one-offs.
3. **One primary button** per page header region; Jobs and Companies Today share the same CTA pattern.
4. Job rows on Today and Interested share **one component**; scores share **one component**.
5. Lead detail shows **one stage primary**; advanced tools behind disclosure; layout uses `Surface`.
6. Voice default path has **no raw JSON**; Save is always reachable.
7. **Mobile:** sidebar is available via Sheet; content readable at 375px width without horizontal page scroll.
8. Match/Fit/Budget/gate jargon has **tooltip or helper** with the approved copy; tooltips are keyboard accessible.
9. Empty, error, and success states use **shared components** on every primary screen.
10. A new user can: complete onboarding → Find jobs → mark Interested → (companies) Accept → Approve to Queue without reading code or JSON.
11. Nav labels match on-page titles (Voice page title aligns with nav meaning; Company not “Lead” in UI chrome).
12. Admin no longer is the only place to understand funnel health — Analytics is the glance view; Admin is ops.

---

## Appendix A — Mobbin references used (adapt, don’t clone)

| Pattern need | Sources |
|---|---|
| Job list + scoring | Contra, Glassdoor, Employment Hero, Workable screens |
| Sidebar IA | Linear, Base44 |
| Onboarding / profile | Remote, Mercor, Uxcel flows |
| Email queue | GoDaddy, Shopify Email, Squarespace campaigns |
| CRM detail calm | Twenty, Attio (prefer over HubSpot/Apollo density) |
| Settings forms | Twenty, Clerk, Origin, Dovetail |

## Appendix B — Skills applied

- `saas-ux-ui-audit` (flow clarity, action hierarchy, toolbar, spacing, a11y)
- `vercel-react-best-practices` (installed for implementation phase — bundle/rerender when refactoring TSX)
- `shadcn` (Vercel skill — primitives to add: Tooltip, DropdownMenu, Sheet, Toast)
- Frontend design craft constraints (clarity over decoration; reuse tokens already in `globals.css`)

---

*End of audit. Implementation should proceed Phase A → B before visual experimentation.*
