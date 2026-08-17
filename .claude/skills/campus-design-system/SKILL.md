---
name: campus-design-system
description: Visual language for workspace surfaces — tokens, typography, empty states, illustration rules. Use when styling any Campus screen or component.
---

# Campus design system

Authority: `docs/design/WORKSPACE_DESIGN.md`. Direction: editorial academic
notebook × desktop workspace — quiet, dense when useful, warm. Anti-patterns:
SaaS dashboard, stat-card soup, purple gradients, shadcn-demo look,
everything-rounded.

## Rules that bite

- Tokens only: colors come from `globals.css` variables (`--color-ink`,
  `--color-paper*`, `--color-rule`, `--color-accent`, semantic
  success/warning/danger). No raw hex in components; CodeMirror themes use
  `var(--...)` too.
- Borders carry structure; shadows are near-zero. Radius: md for controls,
  lg for containers — nothing pill-shaped except deliberate badges.
- Motion 120–180ms, respects `prefers-reduced-motion`.
- Unknown academic data is carried by TEXT, never color alone
  ("no publicó las correlatividades…"). This is a regression-tested product
  claim, not a style choice.
- Empty states: small editorial line-art SVG (books, folders, index cards),
  `currentColor` so theme-aware, `aria-hidden` (decorative), ALWAYS with a next
  action. No stock-illustration flooding.
- Editor body is the most-read text in the app: reading size (0.9375rem+),
  line-height ≥1.6, measure ≤72ch, centred column.
