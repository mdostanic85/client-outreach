# Optra — Design System

Light, calm and near-monochrome. Three light surfaces do the layering, one
near-black ink carries the text at four opacities, and lime (the reference's
`#DAFF95 → #BFEE67` gradient) is the only accent. Controls are pills; containers are rounded rectangles.

The reasoning, measured values and the reference this was derived from live in
[`docs/design/reference-ui-audit.md`](docs/design/reference-ui-audit.md)
(§16 tokens, §17 reuse, §18 product translation, §20 blueprint).
Tokens are defined once in `src/app/globals.css` (`@theme inline` + `:root`).

## Mode

**Light page, dark sidebar.** The app is light. The sidebar (and the mobile
nav sheet) opt into the `.dark` token block with `class="dark"`, so every
token inside it flips; there is no global dark mode.

## Color

| Role | Token / utility | Value |
|---|---|---|
| Page | `--page` · `bg-background` | `#F2F5FA` |
| Card | `--surface` · `bg-card` | `#FFFFFF` |
| Subtle tile / track / row hover | `--subtle` · `bg-subtle`, `bg-muted` | `#F0F2F6` |
| Inverse (primary action) | `--inverse` · `bg-primary`, `bg-inverse` | `#1A1A1C` |
| Ink 100 | `text-foreground`, `text-ink` | `#1A1A1C` |
| Ink 80 (emphasis) | `text-ink-emphasis` | `#1A1A1C` 80% |
| Ink 64 (secondary) | `text-muted-foreground`, `text-ink-secondary` | `#1A1A1C` 64% |
| Ink 40 (tertiary, non-essential only) | `text-ink-tertiary` | `#1A1A1C` 40% |
| Border (dividers, outline buttons) | `border-border` | `#DFE4EB` |
| Border (inputs, chips, badges) | `border-input`, `border-border-strong` | `#D7DDE5` |
| Border hover (nav pill outline) | `border-border-hover` | `#E3E7ED` |
| Brand fill (capsule, toggle on, avatar, active dot) | `bg-brand`, `bg-brand-gradient` | `#BFEE67` / `#DAFF95 → #BFEE67` |
| Text on brand fill | `text-on-brand` | `#1A1A1C` |
| Brand text (AA on white and page) | `text-brand-ink` | `#3B6A00` (lime `#BFEE67` in the dark sidebar) |
| Brand wash | `bg-brand-wash` | `#F1FBD9` |
| Thin marks (bars, rings, progress, stepper) | `bg-chart-1`, `--leaf` | `#559200` — lime is too light for 3:1 on white |
| Hover surface | `bg-hover` | `#E6EAF1` — darker than white and the page, so hovers never melt in |
| Danger (text + fill) | `text-destructive` / `bg-destructive-wash` | `#BE3F31` / `#FBECEA` |
| Warning | `text-warn` / `bg-warn-wash` | `#8F5F0A` / `#FBF1DE` |
| Success | `text-success` / `bg-success-wash` | `#2E7D4F` / `#E5F3EA` |
| Focus ring | `--ring` | leaf `#559200`, 2px, 2px offset |
| Scrim | `--scrim` | `#1A1A1C` 35% + `blur(14px)` |

- Secondary text is 64%, not the reference's 60%: 60% drops below AA on the
  page tint and on subtle tiles at 14px.
- Lime is a fill, never text or a thin line (1.3:1 on white). Accent text uses
  `text-brand-ink`; thin marks use `--leaf`.
- Charts: `--chart-1` leaf, `--chart-2` light lime, then neutral tints
  (`--chart-3/4`) and ink (`--chart-5`). No other hues.

## Type

**Inter Tight** everywhere (`next/font/google`, `--font-sans`). Weight **400**
by default, **500** for page titles and a few labels. Letter-spacing normal,
no uppercase eyebrows. Numbers use `.tabular` (tabular figures, same family).
A system mono stack (`font-mono`) is kept only for raw text/JSON editors.

| Token | Size / leading | Use |
|---|---|---|
| `text-h1` | 52 / 1.1 | Auth, welcome, onboarding hero only |
| `text-h2` | 40 / 1.15 | Hero moments |
| `text-h3` | 32 / 1.2 | Large numerals |
| `text-h4` | 24 / 1.25 | **Page titles in the app** |
| `text-h5` | 20 / 1.35 | Card and section titles |
| `text-body-lg` | 18 / 1.5 | Lead paragraphs |
| `text-body` | 16 / 1.5 | Body |
| `text-body-sm` | 14 / 1.5 | Supporting copy, table cells |
| `text-caption` | 12 / 1.5 | Badges, stat labels |

Base `h1`–`h3` step down one scale level per breakpoint (<640 / ≥640 / ≥768).

## Spacing

4px base: `4 8 12 16 20 24 32 48 72`. Tight inside groups (16–24), wide
between groups (48–72). The reference's 100 / 156 section gaps are marketing
only and not used in the app.

## Layout

- Container max **1290px**, 20px gutter (16px below 640).
- **12-column grid, 16px gap** for tile layouts.
- Sidebar 248px (logo centered, 104px wide, 20px lower): a dark (`.dark` scope) floating panel, 12px from the
  viewport edges, 20px radius, `shadow-card`. Groups "Daily" (Today, Saved,
  Queue) and "Setup" (Profile, Search criteria, Improve); Settings and the
  signed-in account (log out) pinned to the bottom.
- Topbar 64px: a floating white panel (20px radius, `shadow-card`) beside the
  sidebar, so it reads apart from the tinted content; sticky, never hides,
  its shadow deepens slightly after 100px of scroll.
- A "Skip to content" link is the first focus stop in the app shell.
- Page header: split pattern — title + description left, context chip +
  actions right. Stacks on phones.
- Phones (< 640px): 16px gutter, stacked page headers, full-width sheets,
  buttons stack in forms and onboarding.
- Below `lg` the sidebar becomes a right-side sheet opened from a round
  hamburger.

## Radius

| Token | Value | Use |
|---|---|---|
| `rounded-full` | pill | Buttons, chips, badges, tabs, nav items, search field |
| `rounded-card` (`2xl`) | 20 | Cards, accordion items, dropzone |
| `rounded-panel` (`xl`) | 16 | Nested panels, overlays |
| `rounded-tile` (`lg`) | 12 | Tiles, inputs, rows, stat tiles, logo tiles |
| `rounded-box` (`sm`) | 8 | Small icon boxes |

## Depth

- Surfaces separate by tint first: page → white card → subtle tile.
- White containers resting on the page tint carry a subtle `shadow-card`
  (`0 1px 2px / 4%, 0 2px 8px / 4%`). Nested white-on-white never does.
- White pills (secondary, outline) and the active segment carry `shadow-xs`.
- 1px borders only on small controls, inputs and table dividers.
- `shadow-overlay` (`0 8px 30px rgb(0 0 0 / .15)`) only on dialogs,
  dropdowns, popovers, sheets, toasts and the sticky save bar.

## Components

- **Button** (`ui/button.tsx`): `primary` near-black pill, `secondary` white
  pill, `outline` white + 1px border, `ghost` 64% text with a pill outline on
  hover, `icon` round outlined that fills dark on hover, `destructive`.
  Sizes `sm` 36 · `md` 44 · `lg` 48. Hover is a 150ms change to `bg-hover`
  (or `primary-hover`), press scales to 98%. `capsule` is opt-in: a lime icon capsule that swaps sides with the
  label over 700ms. Use it only for the single hero CTA on welcome /
  onboarding and the main search action.
- **Badge** (`ui/badge.tsx`): 12px pills with a 1px border; tinted `brand`,
  `warn`, `danger`, `success` variants. `StatusPill` and `ScoreBadge` build on it.
- **Card**: white, 20px radius, 24px padding (16 on phones), no border,
  `shadow-card`.
- **Stat tile**: 12px radius, 16px padding, 12px label at 64% over a number.
- **Inputs**: 44–48px, 12px radius, 1px border, white fill. Search is a pill.
- **Segmented control / tabs**: pill track in `#F0F2F6`, white active
  segment, indicator animated with `motion` layout (250ms).
- **Toggle**: lime on-state with a dark thumb.
- **Menus / tooltips / select**: white, 12–16px radius, overlay shadow. Open
  250ms `ease/enter` (y 10 → 0, scale .98 → 1); close 150ms `ease/exit`.
- **Dialog**: scrim 35% + 14px blur (220ms); panel from y 28 / scale .94
  (320ms); exits at ~60% of that with `ease/exit`. Esc, focus trap and scroll
  lock come from Base UI.
- **Sheet**: slides from the right, same scrim, 300ms in / 200ms out, full
  width on phones.
- **Accordion** (`ui/accordion.tsx`): measured-height + opacity, 300ms.
- **Lists**: rows on one white card with 1px dividers; hover `#F0F2F6` at
  150ms; no translate on hover, rows reveal on scroll. A job row is clickable as a whole
  (stretched link) and opens the **job page** (`/jobs/[jobId]`): a header card
  (title, company, score, status, actions), then "Why it fits you" and "About
  the job" on the left and "At a glance", "Company" and a plain "Next step"
  card on the right. Every triage action lives there; on phones the actions
  float in a pill bar at the bottom, and the list row shows the score number
  only.

## Motion

| Token | Value |
|---|---|
| `--duration-fast` | 150ms — hover color/surface |
| `--duration-default` | 250ms — menus, toggles, segmented indicator |
| `--duration-moderate` | 300ms — accordion, sheet |
| `--duration-slow` | 600ms |
| `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `ease-enter` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `ease-exit` | `cubic-bezier(0.32, 0, 0.67, 0)` |

Allowed in the app: first-load reveal of page headers and empty states
(`AnimateIn`, 8px + 8px blur, ~360ms), the **scroll / open reveal** (below), 150ms hover changes, overlay
choreography, value swaps (out y −12 / in y +12, 220 / 280ms), one-time
number counters, and live progress indicators while work is running.

**Scroll / open reveal.** Cards, stat tiles, accordion items and list rows
carry `data-reveal`. The first time one scrolls into view (or appears on a
newly opened page) it comes into focus: blurred 10px and 24px low, rising to
sharp over 600ms with `ease/enter`; list rows stagger 50ms (max 5). Played
once, never reversed. `RevealObserver` (root layout) flips `data-in`; an
inline script sets `html.reveal-ready` before first paint, so nothing is
hidden without JS or under reduced motion.

Not allowed: smooth-scroll libraries, parallax, looping ambient decoration, 700ms hovers (except the capsule CTA).

`prefers-reduced-motion` removes translate and blur entrances, counters and
loops.

## Accessibility

- Visible focus ring on every interactive element (unlayered rule in
  `globals.css`, so `outline-none` cannot remove it). Menu items and options
  show focus as a highlighted row.
- Body and secondary text meet WCAG AA on white, the page tint and subtle
  tiles. Tertiary ink is for non-essential text only.
