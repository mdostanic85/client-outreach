# Handoff prompt: Optra new UI

Copy everything below the line into a new Claude Code session opened in the Optra repo.

---

You are redesigning the Optra web app UI on the existing `new-UI` branch. Work as a senior product designer and frontend engineer. The visual direction is already decided and documented. Your job is to implement it across the whole app without changing product behavior.

## Read first, in this order

1. `AGENTS.md`. This project runs **Next.js 16.2**, which differs from what you know. Before touching routing, layouts, fonts or server/client boundaries, read the relevant guide in `node_modules/next/dist/docs/`.
2. `docs/design/reference-ui-audit.md`. This is the **source of truth** for the new design system. Sections 16 (tokens), 17 (what to reuse and what not), 18 (translation to Optra screens) and 20 (blueprint and adoption priority) are binding. Sections 1–15 explain the reasoning and exact values.
3. `DESIGN.md`. This is the **current** system (dark only, Inter + Space Grotesk, verdigris accent). You are replacing it.
4. `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/*`, `src/components/motion.tsx`, `src/components/app-sidebar.tsx`, `src/components/app-topbar.tsx`, `src/components/page-shell.tsx`.

## Stack (do not add to it without a reason)

- Tailwind CSS v4 with `@theme` tokens in `src/app/globals.css`
- shadcn/ui components on `@base-ui/react` in `src/components/ui`
- `class-variance-authority`, `tailwind-merge`, `clsx`
- `motion` (v12) and `tw-animate-css` for animation, plus the existing `AnimateIn` helper
- `lucide-react` icons
- `next/font/google` for fonts
- pnpm

**Do not add GSAP, Lenis, Swiper or NumberFlow.** The reference uses them, but the audit (§17 C and §19) says they are marketing-only or replaceable with CSS and `motion`. The one exception: if animated number counters on analytics tiles cannot be done cleanly with `motion`, ask before adding NumberFlow.

## Design decisions already made

- **Theme: light**, following the reference.
  - Page `#F2F5FA`, card `#FFFFFF`, subtle tile `#F0F2F6`.
  - Remove the hard-coded `dark` class from `<html>` in `layout.tsx`.
  - Keep the `.dark` token block working if it is cheap, but light is the only designed mode.
- **Text:** `#1A1A1C` at 100 / 80 / 60 / 40% opacity for primary / emphasis / secondary / tertiary. No separate gray hues.
- **Primary action:** near-black `#1A1A1C` pill buttons, as in the reference.
- **Brand accent:** keep Optra's verdigris `#39A185` (hover `#63B8A3`). It replaces the reference's lime (button icon capsule, toggle on-state, active indicators). Use it for data too: scores, charts, progress. **Do not introduce the reference violet.**
- **Keep semantic colors** for danger (`#E26A5B`) and warning (`#E0A53A`), retuned for contrast on light surfaces (WCAG AA on white for text).
- **Font:** Inter Tight for everything, weight 400 by default and 500 only for the page title and a few labels. Remove Space Grotesk. Keep JetBrains Mono only for numeric scores, if it still reads well; otherwise use Inter Tight with tabular numbers.
- **Type scale (product-sized, from audit §16):**
  - Sizes: h1 52 · h2 40 · h3 32 · h4 24 · h5 20 · body-lg 18 · body 16 · body-sm 14 · caption 12
  - Leading: 1.1–1.2 for headings, 1.5 for body
  - In the app, page titles are usually h4 (24px). 40–52px only appears on auth, welcome and onboarding hero moments.
- **Spacing** on a 4px base: `4 8 12 16 20 24 32 48 72`. The 100 and 156 values are marketing-only; do not use them in the app.
- **Radius:**
  - Controls (buttons, chips, badges, tabs, nav items, inputs-as-search) are pills.
  - Containers: cards 20, nested panels 16, tiles/inputs/rows 12, small icon boxes 8.
- **Depth:**
  - No shadows on cards. Surfaces separate by tint.
  - Borders are 1px `#D7DDE5` / `#DFE4EB`, only on small controls, inputs and table dividers.
  - Shadow `0 8px 30px rgba(0,0,0,.15)` only on true overlays (dialog, dropdown, sheet, toast).
- **Focus:** a visible focus ring on every interactive element. Use 2px verdigris with 2px offset. The reference suppresses focus; do not copy that.
- **Motion tokens (audit §8.3):**
  - Durations: fast 150, default 250, moderate 300, slow 600
  - `ease/standard cubic-bezier(0.4,0,0.2,1)`
  - `ease/enter cubic-bezier(0.22,1,0.36,1)`
  - `ease/exit cubic-bezier(0.32,0,0.67,0)`
  - Enter slow, exit fast.
- **`prefers-reduced-motion` must disable** translate and blur entrances and any looping motion.

## What to build, in phases

Commit at the end of each phase on `new-UI` with a Conventional Commit message. **Do not push and do not open a PR** unless I ask.

### Phase 1: Foundation

1. Rewrite the tokens in `globals.css` (`@theme inline` + `:root`) to the system above. Map shadcn semantic variables (`--background`, `--card`, `--muted`, `--border`, `--primary`, `--ring`, `--sidebar-*`, `--chart-*`, etc.) to the new values, so existing components pick them up before you touch them.
2. Add the motion tokens as CSS variables, and update the `animate-enter*` keyframes used by `AnimateIn`:
   - Entrance: opacity 0→1, translateY 8px→0, blur 8px→0, 300–400ms, `ease/enter`.
   - Honour reduced motion.
3. Fonts in `layout.tsx`: Inter Tight via `next/font/google`, and the type scale as utilities or base styles for `h1`–`h6` and `p`.
4. Update `DESIGN.md` to describe the new system. Replace the old content and point to `docs/design/reference-ui-audit.md` for the reasoning.

### Phase 2: Core components (`src/components/ui` and shared primitives)

- **Button** (cva variants):
  - `primary`: `#1A1A1C` pill, 44–48px.
  - `secondary`: white pill.
  - `outline`: white pill with a 1px border.
  - `ghost`: transparent, 60% text, pill outline on hover.
  - `icon`: round outlined, fills dark on hover.
  - `destructive`.
  - Sizes sm / md / lg.
  - Hover is a 150ms color/surface change. Add an opt-in `capsule` variant implementing the audit's icon-capsule swap (§5.1, 700ms). Use it **only** for the single primary CTA on welcome/onboarding and the main search action.
- **Badge / status pill / score badge:** 12px pills with a 1px border, plus tinted variants for status. Reconcile `badge.tsx`, `status-pill.tsx` and `score-badge.tsx` onto one pattern.
- **Card:** white, 20px radius, 24px padding (16 on phones), no border, no shadow.
- **Stat tile:** 12px radius, 16px padding, 12px label at 60% over a number.
- **Input, textarea, select:** 44–48px, 12px radius, 1px border, white fill, focus ring.
- **Search field:** a pill variant.
- **Segmented control and tabs** (`segmented-control.tsx`, `today-tabs.tsx`, `learning-mode-switch.tsx`): a pill track in `#F0F2F6` with a white active segment. Animate the active indicator with `motion` layout animation (250ms).
- **Toggle:** a verdigris on-state.
- **Dropdown menu, tooltip, select popover:**
  - Surface: white, 12–16px radius, overlay shadow.
  - Open: translateY 10→0, scale .98→1, opacity, 250ms `ease/enter`.
  - Close: 150ms `ease/exit`.
- **Dialog** (`dialog.tsx`, `application-send-modal.tsx`): implement the modal choreography from audit §5.16.
  - Scrim `#1A1A1C` at 35% + `backdrop-blur(14px)`.
  - Enter: scrim 220ms; panel from y 28 / scale .94 over 320ms; content items staggered 45ms.
  - Exit: about 60% of the enter duration, `ease/exit`.
  - Keep Esc, focus trap and scroll lock.
- **Sheet / drawer:** slides from the right with the same scrim, 300ms enter / 200ms exit, full width on phones.
- **Accordion:** add one if none exists. Measured-height animation with opacity, 300ms. Use it on detail pages. No text-line reveal.
- **Empty state, inline alert, toast (sonner):** restyle to the tokens.

### Phase 3: App shell and navigation

- **`app-sidebar.tsx`:**
  - Sits on the page color (`#F2F5FA`), no border.
  - Nav items are 40px pills; inactive text at 60%.
  - Active item is a white surface with a small verdigris indicator.
  - Hover shows a pill outline `#E3E7ED`.
  - Replace the old "left accent bar on row hover" signature.
- **`app-topbar.tsx`:**
  - 56–64px, page title left (h4 24px regular), actions right, one dark primary action at most.
  - On scroll past the first ~100px, it can tuck slightly or gain a hairline divider (200–300ms). It must not hide.
- **`page-shell.tsx`:**
  - Container max about 1290px, 20px gutter (16 below 640), 12-column grid with a 16px gap for tile layouts.
  - Page header uses the split pattern: title + description left, context chip + actions right. Stack it on phones.
- **Mobile:** the sidebar becomes a right-side sheet opened from a round hamburger. Keep existing phone rules from the old `DESIGN.md` (stacked headers, full-width sheets).

### Phase 4: Screens

Apply the audit §18 translation table to every route. Keep all data flow, server actions, props and tests unchanged; this is presentation only.

- **Auth** (`(auth)/login`, `signup`, `forgot-password`, `reset-password`, `welcome`):
  - A centered white card on the page tint.
  - Welcome may use one larger heading (40–52px) and the capsule CTA.
- **Onboarding** (`(onboarding)/onboarding`, `components/onboarding/*`):
  - Use the stepper pattern (audit §5.14): dots plus a filling verdigris line.
  - Advance **on user action only**; no autoplay.
  - Step content swaps with a 12–16px translate plus a 3px blur crossfade, 300–400ms.
  - Buttons stack on phones (keep commit a1a9f3e's behavior).
- **Home / today** (`(app)/page.tsx`, `today-tabs`, `triage-inbox`, `jobs-inbox`, `job-list-item`):
  - Job lists are rows on one white card, with 1px dividers.
  - Row hover is `#F0F2F6` at 150ms, with no translate and no entrance animation per row.
  - Company logo sits in a 12px-radius tile.
  - Score uses the unified score badge.
- **Search** (`search-experience`, `discover-controls`, `search-radar`, `search-criteria/*`):
  - Pill search field and filter chips; the selected chip is dark with white text.
  - The result count uses the value-swap transition (out y −12 / in y +12, 220/280ms).
- **Interested / applications** (`interested`, `interested/[jobId]/package`, `applications-kanban`, `application-package-workspace`, `package-*`, `cover-letter-preview`, `cv-document-preview`):
  - Kanban columns sit on the tint, with white cards.
  - Package editors use cards and the accordion.
  - CV and cover-letter previews open in the dialog or sheet.
- **Queue** (`queue/*`, `queue-board`, `queue-controls`, `queue-workspace`): same list and row rules.
- **Profile** (`profile/*`, `profile-*`, `professional-profile-view`, `linkedin-import-card`, `file-dropzone`):
  - Detail layout with a split header and accordion sections.
  - The dropzone is a dashed 1px border in a 20px-radius card.
- **Analytics** (`analytics`, `analytics-kpi-grid`, `match-insights`, `worth-improving`, `readiness-panel`):
  - Stat tiles in the 12-column grid.
  - Numbers animate once on first view, respecting reduced motion.
  - Charts use verdigris plus neutral tints.
- **Learning** (`learning`, `*-learning-hub`, `learning-controls`), **Settings** (`settings`, `settings/voice`, `settings-form`, `mailbox-connect`, `privacy-controls`, `secrets-status`, `sticky-form-actions`), **Admin** (`admin-workspace`), **Leads** (`leads/[id]`, `lead-workspace`, `company-snapshot`): apply the same card, form and list patterns.

Allowed motion in the app, per audit §17–18:

- A first-load reveal for page headers and empty states (300–400ms, 8px, 8px blur)
- Hover color and surface changes (150ms)
- Overlay choreography
- Value swaps
- One-time number counters

Not allowed in the app:

- Smooth-scroll libraries
- Scroll-triggered reveals on list items
- Parallax
- Looping ambient animation
- 700ms hovers (except the capsule CTA)

### Phase 5: Verification and polish

Run all of these and fix what fails before reporting:

- `pnpm lint`
- `pnpm test` (all suites must stay green)
- `pnpm build`
- Start the dev server with the preview tools (`.claude/launch.json`; create an entry for `pnpm dev` on port 3000 if missing).
- Visit **every route listed above at 1440×900, 768×1024 and 375×812.**
  - Check there is no horizontal scroll, text contrast is at least AA, and focus rings show when tabbing through each page.
  - Check dialogs and sheets open and close with Esc.
  - Check reduced motion (emulate it) removes entrances.
  - Check there are no console errors.
- Search the codebase for leftovers from the old system and remove them:
  - Old hex values (`#0a0c11`, `#0f121a`, `#1c212c`, `#98a2b3`)
  - `font-display` / Space Grotesk usages
  - Hard-coded `dark` classes

## Rules

- Presentation only. Do not change business logic, API routes, database code, auth flow, scoring or collectors. If a component mixes logic and markup, change only the markup and classes.
- Reuse and extend the existing components; do not create parallel duplicates. Match the surrounding code's naming and comment style.
- Do not copy anything brand-specific from the reference: the Nexsas name, logo, the 5-square chevron glyph, photography, illustrations or the lime gradient.
- Keep accessibility at least as good as today: labels, roles, keyboard paths, focus management in overlays.
- If a decision is genuinely ambiguous and changes the result (for example, a screen that has no equivalent pattern in the audit), make the sensible choice, note it in the final report and keep going. Stop and ask only for things that would change product behavior.

## Final report

When done, reply with:

1. What changed per phase, with the commit hashes.
2. Screenshots of home, search, a job detail or package page, onboarding and analytics at desktop and mobile.
3. Any audit recommendation you did not follow, and why.
4. Open issues or follow-ups.
