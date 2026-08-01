# Client Outreach — Design System

Inspired by [Vireo ecommerce dashboard](https://avagon-vireo.vercel.app/src/html/dashboards/ecommerce.html).

## Mode
**Dark only** — Vireo `data-ax-theme=dark` + verdigris accent.

## Fonts
| Role | Family |
|---|---|
| Sans / UI | Inter |
| Display / titles | Space Grotesk |
| Mono / scores | JetBrains Mono |

## Type scale (Vireo `--ax-text-*`)
11 / 12 / 13 / **15** / 17 / 20 / 24 / 30 / 38 — body default **15px**.
KPI / score display: **32px** Space Grotesk.

## Spacing
4 · 8 · 12 · 16 · 20 · **24** · 28 · 32 · 40 · 48 · 64
Page: `px-8 py-8`, section gap `24–32`. Prefer airy over cramped.

## Radius
8 / 12 / **14** / 18 / 24 (pill 999)

## Dark palette
| Token | Hex |
|---|---|
| Canvas | `#0a0c11` |
| Surface | `#161a23` |
| Surface 2 | `#1c212c` |
| Border | `#ffffff12` |
| Text strong | `#eaedf3` |
| Text | `#d4dae4` |
| Text muted | `#98a2b3` |
| Accent (verdigris) | `#39a185` |
| Accent hover | `#63b8a3` |
| Accent wash | `#16302a` |
| Danger | `#e26a5b` |
| Warn | `#e0a53a` |

## Layout
- Sidebar **264px**, sticky
- Content max ~1320px boxed feel for lists
- Control height ~38–44px

## Signature
Verdigris accent wash on active nav + left accent bar on row hover.
