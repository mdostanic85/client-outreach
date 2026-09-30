# Reference UI audit: Nexsas "Automation SaaS" template

Reference: https://automation-saas-ns-next.vercel.app/
Audited: 2026-09-30, on the `new-UI` branch, before any Optra redesign work.

## How this was measured

Every value below comes from one of three sources, and each finding says which:

- **CSS**: the three production stylesheets (Tailwind v4 output). Theme tokens, base styles, breakpoints and component rules were read directly.
- **JS**: the production JavaScript chunks. Animation parameters (durations, eases, offsets, stagger, trigger points) were read from the shipped code, not estimated from video.
- **DOM**: computed styles read in a live browser at 1440×900, 768×1024 and 375×812.

Libraries confirmed in the bundle: **GSAP 3.15** with **ScrollTrigger** plus a line splitter called with the SplitText API (`create(el, { type: "lines", mask: "lines" })`; the plugin name itself is minified away), **Lenis 1.3.23** (smooth scroll, `html.lenis` class present), **Swiper** (testimonials), **NumberFlow** (animated counters), **Tailwind CSS v4**, Next.js. Framer Motion is **not** present.

Excluded from the audit: the red "47+ Pre built demos" side tab and the green "Purchase" pill. They are injected by the template seller's script (`nexsas-themelink.js`) and are not part of the design.

Where something could not be verified it is marked `Not reliably observable`.

---

## 1. Color system

The palette is almost monochrome. A cool off-white page, white cards and near-black text do all the structural work. Two accents are used sparingly and never compete. Violet marks data and state. Lime marks the action affordance inside buttons.

### 1.1 Hierarchy

```
page (#F2F5FA)  →  card (#FFFFFF)  →  inset tile (#F0F2F6)
                                   →  inverse (#1A1A1C / #000)
```

Depth comes from **surface contrast between these three light values**, not from shadows (see §7).

### 1.2 Tokens

| Proposed token | Value | Source name | Where used | Reusable |
|---|---|---|---|---|
| `surface/page` | `#F2F5FA` | `background-13` | `<main>` and footer background | Yes |
| `surface/default` | `#FFFFFF` | `white` | Cards, accordion items, header bar, badges, secondary button | Yes |
| `surface/subtle` | `#F0F2F6` | `background-4` | Icon tiles in cards, hamburger button | Yes |
| `surface/subtle-alt` | `#F4F5F8` | `background-3` | Secondary inset areas | Optional |
| `surface/inverse` | `#1A1A1C` | `secondary` | Primary button, testimonial nav hover fill | Yes |
| `surface/inverse-strong` | `#000000` | `black` | Card hover overlay, icon capsule in secondary button | Yes |
| `text/primary` | `#1A1A1C` | `secondary` | All headings (h1–h6), button labels | Yes |
| `text/secondary` | `#1A1A1C` at 60% | `secondary/60` | Default `<p>`, nav links at rest, captions | Yes |
| `text/tertiary` | `#1A1A1C` at 40% | `secondary/40` | Least important metadata | Yes |
| `text/emphasis-muted` | `#1A1A1C` at 80% | `secondary/80` | Footer and menu links | Yes |
| `text/on-inverse` | `#FFFFFF` / `#FCFCFC` | `white` / `accent` | Text on dark surfaces, active step numbers | Yes |
| `border/default` | `#D7DDE5` | `stroke-3` | Badges, circular icon buttons, step dots | Yes |
| `border/subtle` | `#DFE4EB` | `stroke-1` | Outlined white button | Yes |
| `border/hover` | `#E3E7ED` | `stroke-2` | Nav link hover outline | Yes |
| `accent/primary` | `#864FFE` | `primary-500` | Active step, chart bars, workflow hub icon, stars | Yes (rename for your brand) |
| `accent/action` | `linear-gradient(180deg, #DAFF95 0%, #BFEE67 100%)` | `gradient-14` | Icon capsule inside primary buttons, pricing toggle | Adapt |
| `overlay/scrim` | `#1A1A1C` at 35% + `blur(14px)` | `secondary/35` | Modal backdrop | Yes |
| `overlay/glass` | `#FFFFFF` at 15% + `blur(20px)` | `white/15` | Floating stat panels over photography | Adapt |
| `overlay/glass-tint` | `#FCFCFC` at 5% + `blur(24px)` | `accent/5` | ROI card over photo | Adapt |

Additional raw values in the theme but used rarely or only in illustrations: `#0D0D12` (`background-14`, a second near-black used at 60–80% for small hero copy), `#13171E`, `#0F1217`, `#181D26`, `#070B10` (dark surfaces for a dark variant, only `#070B10` appears on this page, as hamburger bars).

### 1.3 Gradients

| Gradient | Use | Transfer |
|---|---|---|
| Lime vertical `#DAFF95 → #BFEE67` | Button icon capsule | Adapt: brand accent |
| `transparent → #864FFE` horizontal/vertical | Connector lines in workflow illustrations; the stepper progress line | Yes, for progress and connectors |
| `#F2F5FA → transparent` | Fades the page color over the hero video top/bottom | Marketing only |
| White fade `rgba(255,255,255,0) → #FFF` | Masks the bottom of the integrations orbit | Marketing only |

### 1.4 Interaction colors

- **Hover:** mostly a *surface swap* or *opacity step*, not a new hue. Nav link text goes from 60% to 100% and gains a `#E3E7ED` outline. Pricing plan rows go transparent → white. Circular nav buttons go outlined → filled `#1A1A1C`.
- **Active/selected:** white surface on a tinted track (pricing plan list), or violet fill with white text (stepper dots).
- **Focus:** only one rule exists (`focus-visible:outline-1`), and the secondary button explicitly sets `outline-0!`. **Focus styling is effectively missing.** Do not copy that. Define a proper `focus/ring` token.
- **Disabled:** `Not reliably observable` (no disabled controls on the page).

---

## 2. Typography

### 2.1 Family and weights

- **One family: Inter Tight** (self-hosted, `font-display: swap`), antialiased (`-webkit-font-smoothing: antialiased`).
- Buttons carry a `font-ibm-plex-mono` class, but no rule for it ships, so buttons also render in Inter Tight. Treat the mono intent as not implemented.
- **Weight 400 is the default for everything, including h2–h6.** Only `h1` is 500. Weight 500 also appears on a handful of labels and on the header's mega-menu titles. 600 appears only in tiny illustration numerals.
- **Letter-spacing is `normal` everywhere** (one 0.32px exception inside an illustration). No uppercase transforms. The only text transform is `first-letter:uppercase` on buttons.

This is the single most distinctive typographic decision: **large sizes at regular weight**. Hierarchy comes from size and color opacity, not boldness.

### 2.2 Scale (from theme tokens)

| Token | Size | Line height | Default weight | Used for |
|---|---|---|---|---|
| `heading-1` | 68px (4.25rem) | 110% | 500 on h1 | Hero title (≥1280px) |
| `heading-2` | 52px (3.25rem) | 120% | 400 | Section titles (≥1280px) |
| `heading-3` | 40px (2.5rem) | 120% | 400 | Section titles on tablet |
| `heading-4` | 32px (2rem) | 130% | 400 | Hero on mobile, large numerals |
| `heading-5` | 24px (1.5rem) | 140% | 400 | Card titles, section titles on mobile |
| `heading-6` | 20px (1.25rem) | 140% | 400 | Accordion questions, footer column heads, benefit card titles |
| `tagline-new` | 18px | 150% | 500 | Emphasized labels |
| `tagline-1` | 16px | 150% | 400 | Body at ≥640px, buttons, nav links |
| `tagline-2` | 14px | 150% | 400 | Body on mobile, small supporting copy |
| `tagline-3` | 12px | 150% | 400 | Badges/eyebrows, stat labels, step numbers |

### 2.3 Responsive heading mapping (from base CSS)

| Element | <640 | ≥640 | ≥768 | ≥1280 |
|---|---|---|---|---|
| `h1` | 32 / 130% | 40 / 120% | 52 / 120% | 68 / 110% |
| `h2` | 24 / 140% | 32 / 130% | 40 / 120% | 52 / 120% |
| `h3` | 24 / 140% | 24 | 32 / 130% | 40 / 120% |
| `p` | 14 / 150% | 16 / 150% | 16 | 16 |

Verified in the browser: h1 is 32px at 375, 52px at 768 and 68px at 1440; h2 is 24, 40 and 52px.

Note that `h3` defaults to 40px on desktop, but every card title overrides it down to `heading-5` or `heading-6`. The base styles are tuned for marketing headings, and components shrink them locally.

### 2.4 Hierarchy mechanics

- **Size, not weight**, separates levels. A 52px regular heading sits over a 16px regular paragraph at 60% opacity.
- **Opacity replaces a gray scale.** Secondary text is the primary color at 60%, and tertiary is 40%. The UI never uses a separate gray hue for text.
- **Line height tightens as size grows**: 150% for body, 140% at 20–24px, 120% at 40–52px, 110% at 68px.
- **Measure is controlled per block with explicit `max-width`**: hero h1 950px, CTA h2 650px, supporting paragraphs roughly 450–600px, small hero caption 142px. The theme has about 30 distinct `max-w-[…]` values, so measure is tuned by hand, not tokenized.
- **Eyebrow pattern:** a 12px pill badge ("Features", "Pricing") with a small dark icon disc, placed about 20px above the section title.

### 2.5 Density

Marketing sections are sparse: title, one or two lines of support, one CTA. Density rises only inside cards (pricing inclusions list, FAQ answer). Illustration mock-ups use 12–14px text with tight spacing to read as "product UI" against the airy page.

---

## 3. Spacing

**Base unit: 4px** (Tailwind `--spacing: .25rem`). All observed values are multiples of 4, except a 3px badge inset and one 10px menu gap.

### 3.1 Observed usage

| Context | Value |
|---|---|
| Button outer padding (around icon capsule) | 4px |
| Badge padding | 3px 16px 3px 3px |
| Nav link padding | 8px 16px |
| Label → control (e.g. "Monthly" → toggle) | 10px |
| Heading → paragraph in cards | 4px (`space-y-1`) |
| Section title → subtitle | 12px |
| Stat card padding | 16px |
| Grid gap (card grid, desktop) | 16px |
| Accordion item gap | 16px |
| Grid row gap (mobile) | 20px |
| Badge → title; checklist rows | 20px |
| Pricing plan row padding | 12px 20px |
| Card padding | 24px |
| Footer column heading → links | 32px |
| Section header → section body | 72px (`space-y-18`) |
| Two-column split gap (FAQ) | 72px |
| **Section top padding** | **80 / 100 / 156px** (mobile / ≥768 / ≥1024) |
| Hero top padding | 190px (clears the floating header) |

Sections use **top padding only**; bottom padding is 0. Rhythm comes from each section pushing away from the previous one.

### 3.2 Inferred scale

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 72 · 100 · 156`

- 4–12: inside controls
- 16–24: inside and between cards
- 32–72: between blocks within a section
- 80–156: between sections

The jump from 24 (card padding) to 72 (header → content) is deliberate. Nothing sits in the 40–60px range inside a section. That gap is a large part of why the page reads as "calm".

---

## 4. Grid and layout

- **Container:** `.main-container`, `max-width: 1290px`, `padding-inline: 20px`, dropped to `0` at ≥1440px (at that width the 1290px column already has 75px margins).
- **Grid:** 12 columns, 16px gap (`grid-cols-12 md:gap-4`); on mobile `gap-y-5` (20px) with single-column stacking.
- **Card spans:** `col-span-12 → md:col-span-6 → lg:col-span-3` (1 → 2 → 4 across). Feature cards use 6/6. Mixed rows use 5/7 or 4/8 splits. Exact splits vary per section.
- **Breakpoints:** Tailwind defaults `640 / 768 / 1024 / 1280 / 1536`, plus custom `1440` (`lp:`) and `2560` (`2k:`). A few ad-hoc steps (`376`, `425`, `500`) exist only for the header width.
- **Floating header width ladder:** 350 → 375 → 450 → 540 → 720 → 960 → 1140 → 1290px. It is a stepped container, not fluid.
- **Section structure:** full-bleed page color, contained content. Only the hero (video background) and footer tint extend edge to edge.
- **Heights:** fixed card heights are common (`h-[273px]`, `h-[400px] lg:h-[510px]`, dashboard mock `350 / 650 / 825px`). Uniform rows come from fixed heights, not from content.
- **Alignment:** section headers alternate between centered (features, pricing, CTA) and left-aligned title with right-aligned description and CTA (about, process, FAQ).

**What creates the premium full-screen feeling:** a wide 1290px column on a tinted page, very large section gaps, fixed-height cards that align into clean rows, and one oversized hero media block (825px dashboard image on a video).

**Reusable inside a product:** the 12-column grid with 16px gaps, the 20px container gutter, fixed-height tiles for dashboards, and the "title left / description + action right" header pattern (a direct fit for page headers).

---

## 5. Component inventory

Classification: **C** = core, **X** = composite, **L** = layout pattern, **D** = decorative.

### 5.1 Button: "capsule swap" (C)

- **Anatomy:** 48px pill, 4px padding. Left: 56×40 pill "icon capsule" with a 5-dot chevron glyph. Right: label with 16px horizontal padding.
- **Variants:**
  - *Primary:* `#1A1A1C` shell, lime gradient capsule, white label
  - *Secondary:* white shell, black capsule, dark label
  - *Outlined:* white shell with a 1px `#DFE4EB` border and lime capsule
  - *Full-width:* used in the pricing card
- **Hover (JS, `useButtonHoverAnimation`):** on mouseenter the capsule translates right to the far edge and the label translates left by its own offset, so they **swap sides**. `transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)`. Mouseleave reverses.
- **Pressed / focus / disabled:** `Not reliably observable`. The secondary button sets `outline-0!`, so there is no visible focus.
- **Responsive:** hero buttons become `w-[70%]` stacked on mobile.
- **Radius:** full. **Shadow:** none.

### 5.2 Icon button: circular outline (C)

- 52×40 pill (32×40 below 376px), 1px `#D7DDE5` border, transparent.
- **Hover:** fills `#1A1A1C`, border goes transparent, and the icon inverts. `transition-colors 500ms`.
- **Used for:** testimonial prev/next.

### 5.3 Badge / eyebrow (C)

- White pill, 1px `#D7DDE5` border, `3px 16px 3px 3px` padding, 12px/18px label, with a 24px dark icon disc on the left (8px gap).
- Static; no hover.

### 5.4 Floating navbar (X)

- **Structure:** a fixed wrapper, centered with `left-1/2 -translate-x-1/2`, at `top: 20px`, with `backdrop-blur(25px)`. Inside it sits a white, fully rounded bar, 62px tall with 10px horizontal padding.
- **Contents:** logo left, 4 nav items centered, primary button right.
- **Nav link:** 16px, 60% opacity, `8px 16px` padding, pill, transparent 1px border. On hover, text goes to 100% and the border becomes `#E3E7ED` (`200ms`). Dropdown chevron rotates 180° on hover, focus-within or active (`300ms`).
- **Scroll state (JS):** past `scrollY > 100` the wrapper's `top` animates 20px → 8px (`500ms ease-in-out`). It never hides and never changes background.
- **Entrance:** slides down from −100px with blur 16px → 0, opacity 0 → 1, 0.6s, `delay 0.1`, on load.

### 5.5 Dropdown / mega menu (X)

- Hidden state: `opacity 0; translateY(10px); visibility hidden; pointer-events none`.
- **Open:** `@keyframes menuSlideIn`, `translateY(10px) scale(.98) → 0 / 1`, 300ms. An invisible "bridge" element keeps hover alive across the gap. Also opens on `:focus-within`.
- **Menu item:** 10px radius, 12px padding, an icon in a 1px `#D7DDE5` bordered 8px-radius box, a 16px title and a 12px description at 60%.

### 5.6 Mobile menu (X)

- 48px round hamburger (`#F0F2F6` fill) with three 2px bars.
- Opens a full-screen white panel that slides in from the right (`translate-x: 100% → 0`, classes `hide-sidebar` / `show-sidebar`). Duration: `Not reliably observable`.
- Sections are accordion rows (20px items with chevron), and sub-links are indented 16px at 12px size.

### 5.7 Card (C)

- White, **20px radius**, 24px padding, **no border, no shadow**.
- Title `heading-5` (24px) or `heading-6` (20px), with a 4px gap to 16px description at 60%.
- Fixed heights per row.

### 5.8 Benefit card with hover takeover (X)

- 273px tall card: 48px `#F0F2F6` icon tile (12px radius) top-left, title bottom-left.
- **Hover (CSS):** a black layer inside the card rises from `translateY(100%)` to `0` in 700ms `ease-in-out`, revealing a large white icon and title centered. The underlying content simultaneously moves `translateY(16px)` and `scale(.95)` (700ms).

### 5.9 Stat card (C)

- White, 12px radius, 16px padding, centered.
- 12px label at 60% over a 24px number.
- Numbers animate with NumberFlow: rolling digits, 1.8s, triggered once at `top 90%`.

### 5.10 Segmented list / vertical tabs (X, pricing plans)

- 360px column on a tinted track. Each row is a 70px button, 12px radius, `12px 20px` padding, with a 16px title and 12px caption.
- **Active:** white fill (`data-[active=true]:bg-white`). **Hover:** white fill (150ms). The active row shows a round black arrow button on the right.

### 5.11 Toggle switch (C)

- A label + a hidden `peer` checkbox + a custom track. Lime track when on.
- Flanking 14px "Monthly" / "Yearly" labels.
- **Price swap (JS):** the outgoing value goes `y: 0 → -12`, `opacity → 0` (220ms). The incoming value goes `y: 12 → 0` (280ms, starting at 120ms). The container width tweens (280ms, `power3.out`).

### 5.12 Pricing card (X)

- White card: plan badge, title with a large price, description, full-width primary button, and a "What's included:" checklist.
- Checklist rows: 20px gap, a 20px check glyph with 8px gap.

### 5.13 Accordion (X)

- Items are white, 20px radius, `0 24px` padding (16px on mobile), 16px apart. The question is `heading-6` (20px), with a 28px plus/minus icon.
- **Open (JS):** height tweens from 0 to the measured `scrollHeight`, then to `auto`, with opacity. `transition: height, opacity 300ms ease-in-out`.
- The answer paragraph gets a **line-by-line mask reveal**: SplitText lines, `yPercent 110 → 0`, opacity, 0.8s, stagger 0.08, `power3.out`.
- Single-open by default.

### 5.14 Process stepper (X)

- A large card with image left and content right. A vertical rail on the right shows 32px step dots (01–04) joined by a line.
- **Dot states:** inactive is outlined `#D7DDE5` with 60% text; active and completed are violet with white text. `transition-all 400ms`.
- **Autoplay (JS constants):** `STEP_WAIT 1.2s`, `LINE_DURATION 1s` (the connector fills via `scaleY` from 0, `sine.inOut`), `OPEN_DUR 1s`, `CLOSE_DUR 0.8s`, `EASE cubic-bezier(0.22, 1, 0.36, 1)`, `TEXT_STAGGER 0.3s`.
- **Image and content swap:** the outgoing panel moves `yPercent ∓100` with `blur(3px)`; the incoming panel comes from `yPercent ±100` with blur 3px → 0. Direction reverses when going backwards. Clicking a dot jumps to that step.

### 5.15 Testimonial slider (X)

- Swiper: 1 slide per view, `speed 650ms`, loop, autoplay `4800ms`, pause on hover, and manual nav restarts autoplay.
- Card layout: photo left, quote right, circular prev/next buttons, a "1/8" counter.

### 5.16 Modal (X)

- Portal, `z-index 9999`, backdrop `#1A1A1C/35` + `blur(14px)`, Esc closes, body scroll locked.
- **Enter:** backdrop opacity 220ms `power2.out`. The panel goes from `y 28, scale .94` to `0 / 1` in 320ms `power3.out`, overlapping −80ms. Items follow from `y 16` in 280ms with 45ms stagger, `power2.out`, overlapping −180ms.
- **Exit:** items to `y 8` in 120ms (stagger 20ms, `power1.in`). The panel goes to `y 16, scale .96` in 180ms `power2.in`. The backdrop fades in 160ms.

### 5.17 Footer (X)

- `#F2F5FA` background. Brand block, then 3 link columns, with a 20px head and 32px gap to links.
- **Link hover:** a 1px underline scales from 0 to 100% (origin flips right → left), so it wipes in from the left and out to the right.
- **Social icons** lift −4px on hover (300ms).
- A copyright bar with `26px / 42px` padding.

### 5.18 Decorative (D)

- **Hero video background** with a floating product screenshot (825px, 20px radius, `backdrop-blur 20px`).
- **Hero mouse parallax (JS):** two layers shift by `clientX·shift/150 × random(-1..1)` with shift 12 and 10. The handler is throttled to 200ms, and each move tweens over 0.6s.
- **Integration orbit:** logos on an arc rotating 360° over 20s, linear, infinite, at `timeScale 0.3`. Items counter-rotate to stay upright.
- **Dotted globe** behind the CTA, a world map with a pulsing avatar, bar charts, workflow node diagrams, and glass stat panels over photos.
- **Avatar stack** (overlap −14px, 2px outline in page color) with an elastic entrance.

---

## 6. Border radius

| Token | Value | Used for |
|---|---|---|
| `radius/full` | 9999px | Buttons, badges, header bar, nav links, icon buttons, avatars, step dots |
| `radius/xl-card` | 20px | Cards, accordion items, large media, card hover overlay |
| `radius/lg-panel` | 16px | Glass panels, nested panels (`rounded-2xl`) |
| `radius/md` | 12px | Stat cards, plan rows, icon tiles (`rounded-xl`) |
| `radius/sm` | 10px | Mega-menu items |
| `radius/xs` | 8px | Small bordered icon boxes (`rounded-lg`) |

The logic is **nested radii decrease**: a 20px card holds a 12px tile, which holds an 8px icon box. Anything that is a control is a pill. The 28px and 36px radii seen in the DOM belong to illustration mock-ups; `Not reliably observable` as part of the system.

---

## 7. Borders, shadows and depth

- **Primary depth mechanism: surface contrast.** White cards on `#F2F5FA`, and `#F0F2F6` tiles on white cards. There are no borders on cards.
- **Borders:** always 1px, used only on **small** elements (badges, outline buttons, icon buttons, step dots, menu icon boxes), in `#D7DDE5` / `#DFE4EB`. Some illustration borders use `#D7DDE5` at 18–25% opacity, and dark glass uses white at 14%.
- **Shadows:** nearly absent from the real UI. The theme ships one real token, `0 1px 2px rgba(16,24,40,.06)`. Heavier shadows (`0 8px 30px rgba(0,0,0,.15–.18)`, `0 8px 6px rgba(16,24,40,.16)`) appear only on floating elements inside illustrations. A `0 0 0 6px` white/`#EAECEB` ring outlines hub icons.
- **Blur:** a key layering tool.

  | Blur | Where |
  |---|---|
  | 25px | Header |
  | 20px | Glass panels over photos |
  | 14px | Modal scrim |
  | 24px | Tinted glass |
  | 16px | Reveal entrance (animated) |
  | 3px | Process swap (animated) |
  | 5px | Avatar entrance (animated) |

- **Motion as depth:** entrances animate `blur → sharp`, which reads as "coming into focus" and adds a z-axis feeling without any shadow.

**Rule set to reuse:** flat surfaces, separation by tint, 1px borders only on small controls, blur for anything that floats over content, and shadows reserved for true overlays.

---

## 8. Motion system

All values come from shipped code unless marked otherwise.

### 8.1 Inventory

| Animation | Trigger | Properties | Duration | Delay / stagger | Ease |
|---|---|---|---|---|---|
| **Block reveal** (`RevealAnimation`, the default for almost every element) | ScrollTrigger `top 90%`, plays once | opacity 0→1, `blur(16px)→0`, y +60px→0 (or x ±60, or y −60) | 600ms | per-element `delay` prop | `power2.out` |
| **Heading line reveal** (`TextReveal`) | ScrollTrigger `top 90%` | SplitText lines masked, `yPercent 110→0`, opacity | 800ms | 80ms per line | `power3.out` |
| Header entrance | Page load | y −100→0, opacity, blur 16→0 | 600ms | 100ms | `power2.out` |
| Hero avatars | Scroll/visible | x −50→0, scale 0→1, `blur(5px)→0`, opacity | 1500ms | 100ms stagger | `elastic.out(1, 0.7)` |
| Hero caption | Load | x +50→0, blur, opacity | 600ms | 200ms | `power2.out` |
| Hero h1 / p | Load | line mask reveal | 800ms | 300ms / 400ms | `power3.out` |
| Counter | ScrollTrigger `top 90%`, once | NumberFlow digit roll | 1800ms | configurable (hero: 400ms) | library default |
| Header scroll state | `scrollY > 100` | `top` 20→8px | 500ms | — | `cubic-bezier(.4,0,.2,1)` |
| Dropdown open | Hover / focus | translateY 10→0, scale .98→1, opacity | 300ms | — | CSS default |
| Nav chevron | Hover | rotate 0→180° | 300ms | — | ease |
| Nav link hover | Hover | color, border-color | 200ms | — | `cubic-bezier(.4,0,.2,1)` |
| Button capsule swap | mouseenter/leave | translateX on capsule and label | 700ms | — | `cubic-bezier(.4,0,.2,1)` |
| Card takeover | Hover | overlay translateY 100%→0; content y+16, scale .95 | 700ms | — | ease-in-out |
| Icon button fill | Hover | bg, border, icon color | 500ms | — | ease |
| Plan row | Hover | bg transparent→white | 150ms | — | ease |
| Price swap | Toggle | out y→−12 fade; in y 12→0 fade; width tween | 220ms / 280ms | in starts at 120ms | `power3.out` |
| Accordion | Click | height 0↔content, opacity; lines reveal | 300ms (+800ms lines) | 80ms lines | ease-in-out / `power3.out` |
| Stepper advance | Auto (1.2s wait) or click | line scaleY 0→1; panels yPercent ±100 with blur 3px | line 1000ms; open 1000ms; close 800ms | text +300ms | `sine.inOut`; `cubic-bezier(.22,1,.36,1)` |
| Step dot | State | bg, color, border | 400ms | — | ease |
| Testimonial slide | Autoplay 4.8s / click | Swiper translate | 650ms | — | Swiper default |
| Modal enter | Open | see §5.16 | 220 / 320 / 280ms | 45ms stagger, overlaps | `power2.out` / `power3.out` |
| Modal exit | Close / Esc | see §5.16 | 120 / 180 / 160ms | 20ms stagger | `power1.in` / `power2.in` |
| Footer link | Hover | underline scaleX 0→1, origin swap | 150ms (default) | — | ease |
| Social icon | Hover | translateY −4px | 300ms | — | ease |
| Hero parallax | mousemove (throttled 200ms) | x, y ≤ ±12px | 600ms | — | GSAP default (`power1.out`) |
| Orbit | Continuous | rotate 360° | 20s ×1/0.3 | — | linear |
| Hero video | Continuous | autoplay loop | — | — | — |

### 8.2 Principles visible in the numbers

- **Enter slow, exit fast.** Modal enter totals about 500ms, exit about 300ms. Process open 1s vs close 0.8s. Exits use `.in` eases, enters use `.out`.
- **Everything enters from blur.** Focus-pull (16px, 5px, 3px) is the signature, stronger than the translate.
- **Short distances.** 60px for blocks, 12–16px for UI swaps, 10px for menus, 4px for hover lifts.
- **Hover transitions are long** (500–700ms) compared with typical UI (150–200ms). This contributes to the "expensive" feel but would feel sluggish in a dense tool.
- **Reveals play once** (ScrollTrigger `toggleActions: "play"` default) and never reverse on scroll-up.
- **Reduced motion:** only NumberFlow checks `prefers-reduced-motion`. GSAP reveals, Lenis and the orbit do not. Do not copy this gap.

### 8.3 Proposed tokens

```
motion/instant     100ms   exits of small items
motion/fast        150ms   color, bg, border hover in dense UI
motion/default     250ms   dropdowns, toggles, small swaps
motion/moderate    300ms   accordion, menus
motion/slow        600ms   element reveal
motion/slower      800ms   text-line reveal, panel swaps
motion/expressive  700ms   marketing hover (capsule swap, card takeover)

ease/standard      cubic-bezier(0.4, 0, 0.2, 1)      CSS transitions
ease/enter         cubic-bezier(0.22, 1, 0.36, 1)    ~ power3.out / expo-out; entrances, panels
ease/enter-soft    power2.out  ≈ cubic-bezier(0.33, 1, 0.68, 1)
ease/exit          power2.in   ≈ cubic-bezier(0.32, 0, 0.67, 0)
ease/emphasized    elastic.out(1, 0.7)               avatars/playful only
ease/linear        linear                            continuous rotation

distance/reveal    60px     blur/reveal   16px
distance/swap      12px     blur/swap     3px
distance/menu      10px     scale/menu    0.98
distance/lift      4px      scale/modal   0.94
stagger/lines      80ms     stagger/items 45ms
```

The cubic-bezier equivalents for GSAP `power` eases are standard approximations, not values read from the site.

---

## 9. Scrolling

### 9.1 Actual scroll behavior

- **Lenis** smooth scroll on the root: `new Lenis({ duration: 1.1 })` via `ReactLenis root`. Other options are left at Lenis defaults (`smoothWheel: true`, `syncTouch: false`), so **touch devices keep native momentum scrolling** and only wheel/trackpad input is interpolated.
- Anchor links with `.lenis-scroll-to` scroll through Lenis with a **−100px offset** to clear the floating header.
- No scroll snap, no horizontal scroll sections, **no pinned sections, no scrubbed animations** (the reveal component hard-codes `scrub: false`; no `pin` usage was found in app code).
- The header is fixed, not sticky.

### 9.2 Animations triggered by scroll

- Nearly every block is wrapped in a reveal that fires when its top crosses 90% of the viewport height, once.
- Counters start at the same trigger.
- Nothing is tied to scroll *progress*. There is no parallax on scroll; the only parallax is mouse-driven in the hero.

### 9.3 Why it feels smooth

1. Lenis interpolates wheel input over about 1.1s, so the page glides and decelerates.
2. Reveals fire early (at 90%) and are short (600ms), so content is settled by the time it reaches reading position.
3. Blur-in hides the translate, so elements "resolve" rather than "slide".
4. There is no scrub or pin work on the main thread; the only per-frame JS is Lenis and ScrollTrigger checks.

---

## 10. Hover and microinteractions

| Element | Behavior | Why it reads premium |
|---|---|---|
| Primary/secondary button | Icon capsule and label swap sides, 700ms | Unexpected, physical, reversible |
| Benefit card | Black panel rises from below; content recedes (y+16, scale .95) | Two-layer motion creates depth |
| Nav link | Text 60→100% and hairline pill outline | Quiet, no color change |
| Nav chevron | Rotates 180° | Signals disclosure |
| Round icon button | Outline → solid dark fill, 500ms | Strong but slow |
| Plan row | Transparent → white | Surface lift without shadow |
| Footer link | Underline wipes in from left, out to right | Directional |
| Social icon | Lifts 4px | Minimal |
| Cursor | `cursor: pointer` on all interactive elements; no custom cursor | — |
| Magnetic effects | None on buttons; the hero uses mouse parallax only | — |
| Pressed / focus | `Not reliably observable`; focus mostly suppressed | Gap to fix |

---

## 11. Navigation

- **Floating pill header**, detached from the viewport edges: 20px from the top, centered, 1290px max.
- **Background:** a solid white inner bar inside a `backdrop-blur(25px)` wrapper. The blur is mostly invisible because the bar is opaque; it only affects the rounded corners' surroundings.
- **Height:** 62px desktop; 68px mobile (48px hamburger + 10px padding).
- **Scroll:** tucks up 12px after 100px of scroll. No hide-on-scroll, no shadow added.
- **Layout:** logo left (198px slot), links centered, one primary CTA right.
- **Active item:** `.active-menu` sets weight 500 and full-opacity color.
- **Mobile (<1280px):** links hidden, hamburger shown, full-screen slide-in panel with accordion groups.
- **Why it feels light:** the bar is thin with no border or shadow, sits on the page color, and nav text is 60% opacity so the CTA is the only high-contrast element.

---

## 12. Visual composition

- **Density:** low. One idea per section, one CTA per section.
- **Whitespace:** 156px between sections and 72px between header and content, but only 16px between cards. Groups are tight and separations are large. This contrast is the core of the layout.
- **Contrast:** the only high-contrast marks are near-black text and the black primary button. Everything else stays within a narrow light range.
- **Rhythm:** sections alternate centered and split headers, and grids alternate 4-up, 2-up and asymmetric.
- **Focal points:** each section has one visual anchor (photo, illustration or large number). Photography is warm and human against the cool UI palette.
- **Layering:** glass panels over photos, product UI mock-ups inside cards, and an orbit arc over the heading.
- **Oversized elements:** the hero title (68px), the dashboard image (1290×825) and the section titles (52px).
- **Balance:** mostly symmetric; asymmetry appears in split headers and the 5/7 card rows.

---

## 13. Icons and graphic language

- **UI icons:** outline style, about 1.5px stroke, 16–24px, in the text color (`stroke-secondary`). Chevrons, plus/minus and arrows.
- **Brand glyph:** a 5-square pixel chevron (a stepped arrow made of 2×2 squares) is reused in every button capsule, badge disc and hub icon. It is the one strong graphic signature.
- **Feature icons:** icon font (`ns-shape-*`), 24px in a 48px `#F0F2F6` tile with 12px radius; 54px white on the hover overlay.
- **Containers:** tile (12px radius, tinted), disc (full radius, dark) and bordered box (8px radius, 1px border).
- **Illustrations:** product UI fragments (tables, charts, notification cards, workflow node trees) drawn with the same tokens as the page. Connector lines use a violet fade.
- **Photography:** candid, outdoor, warm light; always cropped into 20px-radius frames.
- **No 3D.**

**Reusable language:** outline icons at a consistent stroke, tinted square tiles for feature icons, and a single brand glyph repeated in controls.

---

## 14. Responsive system

| Aspect | Mobile (<768) | Tablet (768–1279) | Desktop (≥1280) |
|---|---|---|---|
| Container padding | 20px | 20px | 20px (0 at ≥1440) |
| Section top padding | 80px | 100px (156 at ≥1024) | 156px |
| h1 / h2 | 32 / 24px | 52 / 40px | 68 / 52px |
| Body | 14px | 16px | 16px |
| Card grid | 1 column, 20px row gap | 2 columns (4 at ≥1024), 16px gap | 4 columns |
| Feature card height | 400px | 400px | 510px |
| Nav | Hamburger + full-screen panel | Hamburger | Inline links |
| Header width | 350–450px | 540–960px | 1140–1290px |
| Hero buttons | Stacked, 70% width | Inline | Inline |
| Split headers / FAQ | Stack (gap 24px) | Stack | Side by side (gap 72px) |
| Icon buttons | 40×32 below 376px | 52×40 | 52×40 |

- **What stays fixed:** card heights (273px), radii, button height (48px), badge sizes.
- **Motion on mobile:** same reveals. Lenis is effectively off for touch. Hover effects are inert. Changes for reduced motion: `Not reliably observable` (none were found in code).
- Typography steps down one or two scale levels per breakpoint rather than scaling fluidly.

---

## 15. Interaction principles (supported by the reference)

1. **Surfaces separate, shadows do not.** Hierarchy is tint → white → tint.
2. **Controls are pills; containers are rounded rectangles.** Radius signals interactivity.
3. **Weight stays regular; size and opacity carry hierarchy.**
4. **One high-contrast element per view:** the dark primary button.
5. **Things come into focus.** Every entrance pairs a short translate with a blur-to-sharp.
6. **Enter slow, leave fast.**
7. **Motion is local and short-distance:** 4–16px for UI, 60px for reveals, and nothing crosses the screen.
8. **Large calm areas, small moving details.** The page is static except the element under the cursor and one ambient loop (video or orbit).
9. **Content settles before it is read.** Reveals fire at 90% viewport and finish quickly.

---

## 16. Proposed token set

```yaml
color:
  surface: { page: "#F2F5FA", default: "#FFFFFF", subtle: "#F0F2F6", inverse: "#1A1A1C", inverse-strong: "#000000" }
  text:    { primary: "#1A1A1C", secondary: "#1A1A1C99", tertiary: "#1A1A1C66", on-inverse: "#FFFFFF" }
  border:  { default: "#D7DDE5", subtle: "#DFE4EB", hover: "#E3E7ED" }
  accent:  { primary: "#864FFE", action-from: "#DAFF95", action-to: "#BFEE67" }
  overlay: { scrim: "#1A1A1C59", glass: "#FFFFFF26" }
  focus:   { ring: "accent.primary @ 2px, offset 2px" }   # NOT in reference — add

font:
  family: { sans: "Inter Tight" }
  weight: { regular: 400, medium: 500 }
  size:   { display: 68, h1: 52, h2: 40, h3: 32, h4: 24, h5: 20, body-lg: 18, body: 16, body-sm: 14, caption: 12 }
  leading:{ display: 1.1, heading: 1.2, heading-sm: 1.3, title: 1.4, body: 1.5 }
  tracking: { default: 0 }

space: [4, 8, 12, 16, 20, 24, 32, 48, 72, 100, 156]

radius: { xs: 8, sm: 10, md: 12, lg: 16, xl: 20, full: 9999 }

border: { width: 1 }

shadow:
  xs: "0 1px 2px rgba(16,24,40,.06)"
  overlay: "0 8px 30px rgba(0,0,0,.15)"

blur: { header: 25, glass: 20, scrim: 14 }

opacity: { text-secondary: .6, text-tertiary: .4, text-emphasis: .8, scrim: .35, glass: .15 }

motion:
  duration: { instant: 100, fast: 150, default: 250, moderate: 300, slow: 600, slower: 800, expressive: 700 }
  ease:
    standard: "cubic-bezier(0.4, 0, 0.2, 1)"
    enter:    "cubic-bezier(0.22, 1, 0.36, 1)"
    exit:     "cubic-bezier(0.32, 0, 0.67, 0)"
  reveal: { distance: 60, blur: 16, trigger: "top 90%" }

z:
  header: 50
  modal: 9999

breakpoint: { sm: 640, md: 768, lg: 1024, xl: 1280, lp: 1440, 2xl: 1536 }

container: { max: 1290, gutter: 20 }
grid: { columns: 12, gap: 16 }
```

The 52/40/32 heading tokens above are the reference's `heading-2/3/4` renamed for a product scale, where 68px display is reserved for marketing.

---

## 17. What can be reused

### A. Directly reusable

- The surface system (page tint / white / subtle tint) and depth-without-shadow
- Opacity-based text hierarchy (100 / 80 / 60 / 40)
- Inter Tight at regular weight, 1.5 body leading, tightened heading leading
- The 4px spacing base and the 16px grid gap
- The radius ladder (pill controls, 20/16/12/8 nested containers)
- 1px `#D7DDE5`-style borders on small controls only
- The modal choreography (scrim + blur, staggered panel and items, faster exit, Esc, scroll lock)
- Dropdown open (10px + scale .98, 300ms) and the hover bridge
- The accordion with measured-height animation
- The segmented vertical list with white active surface
- Stat card with rolling numbers (once, on first view)
- Enter-slow / exit-fast easing pairs

### B. Reusable with adaptation

- **Block reveal with blur:** keep it for first render of a page or empty-state illustration. Reduce to 8–12px travel and 300–400ms. Never on every list row.
- **Button capsule swap:** keep for one hero-level CTA per screen (e.g. "Start search"). Use a conventional button with a 150ms color change elsewhere.
- **Card hover takeover:** use as a subtle border/surface change on clickable dashboard cards; drop the full black overlay.
- **Floating pill header:** in an app, a pinned top bar or sidebar is better. The shape (pill tabs, 60% inactive text) transfers to tab bars.
- **Process stepper:** fits onboarding progress without the autoplay. Advance on user action only.
- **Text line reveal:** page titles on first load only.
- **Price-swap micro transition** (12px up/down crossfade): reuse for any value that changes on toggle (salary ranges, counts, filters).
- **Lenis smooth scroll:** only on long-form marketing or landing pages. It interferes with nested scroll areas, virtualized lists and scroll restoration in app screens.

### C. Marketing-specific

- 156px section spacing, 68px display type, one CTA per section
- Scroll-triggered reveals on every block
- Hero video, mouse parallax and the orbit animation
- Testimonial autoplay slider
- Glass panels over photography
- 700ms hover durations

### D. Avoid copying

- The Nexsas name, logo and 5-square chevron glyph (brand-specific)
- Photography, illustration mock-ups and the dotted globe
- The lime gradient as-is (choose your own action accent)
- Suppressed focus outlines (`outline-0!`)
- The absence of `prefers-reduced-motion` handling
- Hand-tuned one-off `max-w-[…]` values; use a measure token instead
- The seller overlays ("47+ Pre built demos", "Purchase")

---

## 18. Translation to a product application (Optra)

| Product area | Reference pattern | Adaptation |
|---|---|---|
| **App shell / sidebar** | Floating pill nav, 60% inactive links, pill hover outline | Fixed sidebar on `surface/page`; nav items are 40px pills, inactive at 60%, active on white `surface/default`. No blur needed. |
| **Top bar** | 62px white bar, CTA right | 56–64px bar, page title left (`h4`, 24px regular), one primary action right. Hide-on-scroll not needed. |
| **Page header** | Title left, description + action right; badge eyebrow | Same split for list pages (Search results, Saved jobs). The eyebrow badge becomes a context chip ("12 new today"). |
| **Job list / tables** | White cards on tint, 16px gaps, no shadows | Rows on one white card with 1px `border/subtle` dividers. Hover = `surface/subtle` background at 150ms. No translate, no reveal, no blur on rows. |
| **Job cards (grid view)** | Fixed-height 20px-radius card, icon tile | Fixed-height cards with a 12px-radius tile for company logo. Hover: border to `border/default` + 2px lift at 150ms, only when the whole card is clickable. |
| **Filters** | Segmented vertical list; pill toggles | Filter groups use pill chips (full radius, 1px border, white). Selected = `surface/inverse` with white text. Numbers that change (result count) use the 12px swap transition. |
| **Search** | Pill button anatomy | 48px pill search field on white, leading icon in a 40px tinted capsule, trailing primary button. |
| **Forms (onboarding)** | Stepper, accordion, toggle | Stepper rail for survey progress (dots + filling line) advancing on submit, not autoplay. Toggles as in the reference. Inputs: 48px, 12px radius, 1px `border/default`, focus ring from the new `focus/ring` token. |
| **Modals** | Scrim 35% + 14px blur; staggered enter; fast exit | Use as-is for confirmations and CV preview. Keep durations (220/320/280 enter, 120/180/160 exit). |
| **Drawers** | Mobile menu slides from right | Job detail drawer from the right, same scrim, ~300ms `ease/enter`, ~200ms exit. |
| **Dashboards / match score** | Stat cards, NumberFlow counters, violet bars | Score and KPI tiles as stat cards; animate numbers once on first load only; violet accent for data. |
| **Empty states** | Block reveal with blur; illustration + one CTA | One illustration, one sentence, one capsule CTA. Allow the reveal (300ms, 8px, 8px blur) here only. |
| **Detail pages** | Split header; accordion FAQ | Job detail: split header (title + company left, Apply right). Requirements and benefits in accordions with the height animation; skip the line reveal. |
| **Data-heavy screens** | — | Drop all entrance animation, keep 150ms hover color changes, and increase density (12px card padding, 8px gaps) while keeping the same tokens. |

---

## 19. Implementation guidance

| Effect | Observed implementation | Suggested for Optra |
|---|---|---|
| Tokens | Tailwind v4 `@theme` variables | Tailwind v4 `@theme` (same approach) |
| Header scroll state | React `scroll` listener → class swap, CSS transition | Same, or IntersectionObserver on a sentinel |
| Floating/fixed header | `position: fixed` + transform centering | `position: sticky` inside the app shell |
| Block reveal | GSAP `from()` + ScrollTrigger `top 90%` | IntersectionObserver + CSS transition (opacity/translate/filter), gated by `prefers-reduced-motion` |
| Text line reveal | GSAP SplitText `mask: "lines"` | Skip in product UI; if needed, SplitText or CSS on pre-split spans |
| Button capsule swap | Measured offsets in JS, CSS `transform` transition | Same technique; CSS-only is possible if widths are known |
| Card hover overlay | CSS `translate` + `group-hover` | CSS only |
| Dropdown | CSS keyframes + class toggle | CSS transitions, or the existing component library's popover |
| Accordion | JS measure `scrollHeight` → px → `auto`, CSS transition | CSS `interpolate-size: allow-keywords` / `grid-template-rows: 0fr→1fr`, JS fallback |
| Modal choreography | GSAP timeline with overlaps | GSAP or Motion; plain CSS can approximate with staggered `transition-delay` |
| Stepper swap | GSAP timeline, yPercent + blur | CSS transitions on state change are enough without autoplay |
| Counters | NumberFlow | NumberFlow (already respects reduced motion) |
| Smooth scroll | Lenis (`duration 1.1`) | Marketing pages only; not in the app shell |
| Slider | Swiper | Only if a carousel is actually needed |
| Blur | `backdrop-filter` | Same; provide a solid fallback color |
| Parallax / orbit | `mousemove` + GSAP; GSAP infinite timeline + ResizeObserver | Not recommended for product |

---

## 20. Transferable design system blueprint

**Color philosophy.** Near-monochrome and cool. Three light surfaces (page `#F2F5FA`, card `#FFFFFF`, tile `#F0F2F6`) do the layering. Text is one near-black at 100/80/60/40% opacity. One data accent (violet) and one action accent (lime in the reference; choose your own) are used sparingly.

**Typography.** A single family (Inter Tight), regular weight almost everywhere, hierarchy by size and opacity, 1.5 body leading tightening to 1.1–1.2 for large headings, no tracking or case changes. Step down one scale level per breakpoint.

**Spacing scale.** 4px base: `4, 8, 12, 16, 20, 24, 32, 48, 72, 100, 156`. Tight inside groups (16–24), wide between groups (72+).

**Radius scale.** Pill for every control; 20 → 16 → 12 → 8 for nested containers.

**Surface system.** Flat. No card borders or shadows; tint contrast separates layers. Blur is for floating layers; shadow is for true overlays only.

**Layout rules.** 1290px container, 20px gutter, 12 columns, 16px gap. Fixed-height tiles in grids. Split page headers (title left, context + action right).

**Component principles.** Pill controls with a clear primary/secondary pair. White cards with 24px padding. Small bordered chips and badges. Segmented lists with white active state. Accordions with measured-height animation.

**Motion rules.** Enter from blur plus a short translate. Enter slow (`ease/enter`), exit fast (`ease/exit`). UI distances are 4–16px, and reveals are capped at 60px and 600ms. Honour `prefers-reduced-motion`.

**Scroll rules.** Native scroll in the product. Reveals fire early (90% viewport) and once, with no scrub or pinning. Lenis is for marketing only.

**Hover rules.** Surface or opacity change, not a new hue. 150–200ms in dense UI, up to 700ms only for single hero CTAs. Lift no more than 4px.

**Responsive rules.** Stack before shrinking. Keep control heights and radii constant. Reduce type by scale steps. Swap the nav for a drawer below 1280px.

**Interaction principles.** Calm surfaces, local motion, one high-contrast action per view, content settled before it is read, and visible focus on every control.

### Recommended adoption priority

**1. Foundation** (everything else depends on it)
- Color tokens: surfaces, text opacities, borders, accents, focus ring
- Inter Tight and the type scale with responsive steps
- Spacing scale, container and grid
- Radius ladder
- Motion tokens (durations, eases) and a global reduced-motion switch

**2. Components**
- Buttons (primary / secondary / outline / icon) and pill chips/badges
- Card, stat card, icon tile
- Inputs, toggle, segmented list, tabs
- Top bar / sidebar navigation, dropdown
- Modal and drawer
- Accordion, stepper
- Table/list row pattern

**3. Motion and polish** (only after the above are correct)
- Modal and drawer choreography
- Hover states (surface and opacity swaps; capsule swap on the one hero CTA)
- Value-swap micro transition for changing numbers
- Number counters on dashboards
- First-load reveals for page headers and empty states
- Marketing-only extras (Lenis, line reveals, card takeover) on the public landing page
