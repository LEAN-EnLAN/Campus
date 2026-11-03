# Campus design system — Campus Blue (proposal 2)

**Status:** the system behind what ships. It was approved as a look and built ad hoc; this
document writes down the rules and the code now follows them. Authority order for visuals:
this file → `docs/design/WORKSPACE_DESIGN.md` (editor/notebook behaviour; its _warm palette_ is
superseded by Campus Blue) → `.claude/skills/campus-design-system`.

**What it is:** a blue-and-white, light-only product. Prompt typeface. Structure is carried by
hairline borders and white surfaces on a very pale blue page, not by shadows or colour fills.
One loud colour (the accent blue), one loud voice for danger. Quiet illustrations, never
decoration. Direction anti-patterns stay: stat-card soup, purple gradients, shadcn-demo look,
everything-rounded.

## 0. How the code is organised

| File                         | Owns                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/styles/globals.css`     | The one entry point: cascade layers, Tailwind, DayFlow, then the imports below **in cascade order**. Nothing else may import a stylesheet. |
| `src/styles/tokens.css`      | Every value in this document: `@theme` (base layer), the **Campus Blue** block, ramp, motion, viewport utilities.                          |
| `src/styles/base.css`        | Element defaults (focus ring, selection, reduced motion), DayFlow skin, keyframes.                                                         |
| `src/styles/campus-blue.css` | The app shell and shared surfaces (`.campus-blue …`: nav, topbar, panels, chips, tables).                                                  |
| `blue-secondary.css`         | Settings and Library surfaces.                                                                                                             |
| `blue-onboarding.css`        | Onboarding and Cloud account entry (`.blue-onboarding`, `.blue-login-*`).                                                                  |
| `blue-startup.css`           | The Local/Cloud picker (`.blue-startup`).                                                                                                  |
| `prompt.css`                 | Local Prompt font-face (OFL, four weights) and the font stack.                                                                             |
| `src/components/ui/*`        | Primitives (section 4).                                                                                                                    |

**Why one graph.** Surfaces used to import their stylesheet from the route that needed it.
Equal-specificity rules then won by _load order_, which depended on which screen you had visited
first (Settings rendered with a 24px different rhythm depending on the path to it). A single
ordered import list makes the cascade a fact of the source, and lets `@shadcn/lint` see every
class (`no-unknown-classes` went from 212 findings to 4).

**Why a "base layer" under Campus Blue.** `@theme` still declares a warm oklch palette and a dark
set. They are not shown (the theme is pinned to light/blue), but `lib/design/palette.ts` derives the
chosen accent from them and the Tailwind utilities (`bg-paper`, `text-ink-muted`) resolve through
the same names. The Campus Blue block re-declares those names for the three full-page surfaces
(`.campus-blue`, `.blue-onboarding`, `.blue-startup`), so **a component never names a colour, only
a role**. Retiring the warm/dark layer is a clean follow-up (section 9).

## 1. Colour

Rule: **a role, not a hue.** Components use `bg-paper-elevated`, `text-ink-muted`,
`border-rule`; stylesheets use `var(--color-…)`. No hex, no `bg-blue-500`, no `rgb()` except
`rgb(var(--shadow-tint) / a)` and white-on-navy overlays.

### Roles (Campus Blue values)

| Token                                                   | Value                                         | Rule behind it                                                                                             |
| ------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `paper`                                                 | `#f8fafd`                                     | The page. Not pure white: panels (white) must read as raised against it.                                   |
| `paper-elevated`                                        | `#ffffff`                                     | Anything you can pick up: panels, inputs, dialogs, menus.                                                  |
| `paper-sunken`                                          | `#eef4fd`                                     | Wells and quiet fills: chips, progress tracks, table stripes.                                              |
| `ink`                                                   | `#10224a`                                     | Body and headings. Navy, not black: keeps the blue family without colour-cast text.                        |
| `ink-muted`                                             | `#566d95`                                     | Secondary text. **4.5:1 on paper, elevated and sunken** (tested).                                          |
| `ink-faint`                                             | `#798dac`                                     | **Not text.** Chevrons, placeholders, decorative glyphs. Fails AA by design.                               |
| `rule` / `rule-soft`                                    | `#d6e1f1` / `#e6edf7`                         | Dividers and card edges. Allowed to be quiet (≈1.3:1): a divider is not information.                       |
| `field`                                                 | `#7a8fb1`                                     | The edge of a form control. **3:1** on paper and white (WCAG 1.4.11): a control's boundary is information. |
| `accent`                                                | `#155dd6`                                     | The one brand colour: primary button, selected nav, links' fill, today marker.                             |
| `accent-hover`                                          | `#0e4dbb`                                     | Pressed/hovered fill; white label still ≥ 4.5:1.                                                           |
| `accent-soft`                                           | `#e7f0ff`                                     | Selected row, info panel, icon tile.                                                                       |
| `accent-ink`                                            | `#1454bd`                                     | Accent as **text** (links, eyebrows); 4.5:1 on paper and on `accent-soft`.                                 |
| `focus`                                                 | = accent                                      | The keyboard ring, 2px + 3px offset on every interactive element. 3:1 on all four surfaces.                |
| `on-tint`                                               | `#ffffff`                                     | Ink for anything painted with a _filled_ palette colour.                                                   |
| `selection`                                             | `#d7e7ff`                                     | Text selection, search highlight, soft borders on accent panels.                                           |
| `success`/`-ink`/`-soft`/`-border`/`-deep`/`-mid`       | `#10a777` / `#067b55` / `#e3f7ef` …           | Passed. `-ink` is the text variant (fills fail as 12px text).                                              |
| `warning`/`-ink`/`-soft`/`-bright`                      | `#9a5f07` / `#8f5d06` / `#fff2d5` / `#efa918` | Regularized. `warning` is **text-dark** (4.7:1 on `warning-soft`); `-bright` is for dots only.             |
| `danger`/`-soft`/`-ink`/`-border`                       | `#c63743` / `#fff0f2` / `#a12a37` / `#ebc8cd` | Failed, destructive. The only other loud colour; keep it rare so it stays loud.                            |
| `shell`, `shell-raised`, `shell-ink`, `shell-ink-muted` | `#133354` / `#285487` / `#e3efff` / `#c6d7ed` | The navy left rail and mobile top bar: the one dark surface.                                               |
| `canvas`, `startup`, `startup-wash`                     | `#f8fafd` / `#f8fbff` / `#eaf3ff`             | **Root-level** page colours so the scrollbar gutter (painted by `<html>`) matches the surface.             |

### Ramp (primitives)

`--blue-01 … --blue-16`, darkest first, are the clusters of every blue the stylesheets used to
hardcode (distance ≤ 0.04 in OKLab, below a noticeable step). They exist so a one-off tint still
resolves to a system value. **Reach for a role first; a ramp step means "no role exists yet" and is
a prompt to name one.**

### Verified contrast

`src/lib/design/blue-contrast.test.ts` measures the shipped hex values: 20 text pairs ≥ 4.5:1, focus
ring ≥ 3:1 on four surfaces, field edge ≥ 3:1 on two. Writing it found two palette bugs that had
shipped: `field` was 2.84:1 on paper and 2.97:1 on white (needs 3:1), and `warning` was 4.05:1 on its
soft fill and 4.496:1 on white (needs 4.5:1). Both were darkened (`#8397b7 → #7a8fb1`,
`#a96808 → #9a5f07`).

### Status is never colour alone

Unknown or unavailable academic data is **text** ("no publicó las correlatividades…"); product
claim, regression-tested. `data-status` chips pair colour with a label, and non-results change
_shape_: `blocked` is a dashed outline, `unmarked/pending/available` is a hollow ring.

| `SubjectStatus`                    | Chip                        | Dot                 |
| ---------------------------------- | --------------------------- | ------------------- |
| `in_progress`                      | accent-soft / accent-ink    | accent fill         |
| `regularized`                      | warning-soft / warning-ink  | warning-bright fill |
| `passed`, `equivalent`             | success-soft / success-ink  | success fill        |
| `failed`                           | danger-soft / danger        | danger fill         |
| `available`, `pending`, `unmarked` | sunken / ink-muted          | hollow ring         |
| `blocked`                          | transparent, dashed outline | hollow ring         |

## 2. Typography

- **Family:** Prompt (local, `public/fonts/prompt`, weights 400/500/600/700, `font-display: swap`).
  Headings use the same family: the old serif is gone from the blue system (`.campus-blue .font-serif`
  maps to Prompt, so legacy `font-serif` classes render correctly).
- **Scale** (`--text-*`, px at 16px root; line-height rides with the step). Rule: reading text is
  never below `sm`; `2xs` is for tracked caps labels only.

| Step   | px  | Use                                                                 |
| ------ | --- | ------------------------------------------------------------------- |
| `2xs`  | 11  | Eyebrow / tracked caps labels, counters                             |
| `xs`   | 12  | Metadata, chips, helper text                                        |
| `sm`   | 13  | Secondary UI text, table cells, field text                          |
| `base` | 15  | Body (the product is read all day; 15 not 14)                       |
| `lg`   | 17  | Card/dialog titles                                                  |
| `xl`   | 22  | Section titles                                                      |
| `2xl`  | 28  | Page title (mobile)                                                 |
| `3xl`  | 36  | Page title (desktop). Screen titles use `clamp(2rem, 3vw, 2.6rem)`. |

- **Tracking:** `tracking-eyebrow` (0.12em) and `tracking-caps` (0.18em) are the only positive
  tracking. Display titles use −0.025em to −0.04em (Prompt is wide).
- **Numerals:** `time` and `[data-numeric]` are tabular.
- **Measure:** prose ≤ 72ch; the editor column keeps `line-height ≥ 1.6`.

## 3. Space, shape, elevation, motion

| Scale        | Values                                                                                                                                                                                                | Rule                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Spacing      | Tailwind's 4px scale (`gap-3` = 12px). Panels pad 16px (13.6px under 768); screens gap 24px (19px under 768).                                                                                         | 4px grid. Related things 8–12, groups 16–24, sections 32+.                                                              |
| Layout rails | `--spacing-nav` 220px, `--spacing-rail` 260px, `--spacing-measure` 832px, `--spacing-dialog-top` min(12vh, 6rem)                                                                                      | Named so the shell, editor and dialogs agree.                                                                           |
| Radius       | `xs` 3 · `sm` 6 · `md` 8 · `lg` 12 · `xl` 16 · `2xl` 20 · `pill` 999                                                                                                                                  | `md` controls, `lg` containers, `xl` hero cards. Pill only for badges and progress tracks.                              |
| Border       | 1px hairline in `rule`/`rule-soft`; 2px only for the focus ring and a selected option; dashed = empty/drop zone                                                                                       | Borders carry structure.                                                                                                |
| Elevation    | `shadow-raised` 0 1 2 (6% tint) · `shadow-overlay` 0 12 32 (16%) · `shadow-floating` 0 10 28 (18%)                                                                                                    | Shadows are ink-tinted (`--shadow-tint: 24 50 94`). Resting surfaces have none; only things that float have one.        |
| Z-index      | 1 (raised chip) · 40 (calendar hover chip) · 50 (dialog) · 100 (skip link) · 1200 (`.campus-status-menu`, a popover portaled to `<body>`; to be folded into the scale)                                | Keep to this list; a new layer needs a name here first.                                                                 |
| Motion       | `duration-quick` 150ms (hover, focus, colour) · `duration-panel` 200ms (things that move) · `duration-ambient` 600ms (time-of-day backdrop only) · easing `ease-out-quiet` (cubic-bezier .22 .8 .3 1) | Never animate layout on load. Every animation respects `prefers-reduced-motion` (global 0.01ms override in `base.css`). |
| Breakpoints  | `sm` 640 · `md` 768 · `lg` 1024 (Tailwind); content split at 1100                                                                                                                                     | Raw `max-width` queries are 639 / 767 / 1023 only. Tested at 390, 768, 1440.                                            |

## 4. Primitives (`src/components/ui`)

| Primitive                                            | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`                                             | Variants `primary · secondary · ghost · danger · link`; sizes `md 40 · sm 32 · lg 44 · icon 36 · icon-touch 44`. A screen rarely needs two primaries. It owns colour and spacing — do not restyle with `className` (lint `no-restyle`). Touch targets ≥ 44px on touch surfaces.                                                                                                                                                                                                                        |
| `Field`, `TextField`, `SelectField`, `TextareaField` | `<label htmlFor>` always; error linked by `aria-describedby` + `aria-invalid`; error text is words, not just a red border. The select's chevron is a Lucide icon in `ink-muted` (it was a hardcoded warm-grey data-URI).                                                                                                                                                                                                                                                                               |
| `Modal`, `ModalFooter`                               | `role=dialog`, `aria-modal`, named by `labelledBy`. Escape closes; Tab wraps over the **real tab stops** (`tabbable.ts`: a radio group counts once; hidden/inert/disabled skipped); focus restored on close; scroll locked. The backdrop is pointer-only (`aria-hidden`, not in the tab order). Panel is a bottom sheet under `sm` (`max-h-sheet`), centred from `sm` (`max-h-dialog`), both `dvh`-based. `ModalFooter` is sticky with a top rule and safe-area padding so Save/Cancel stay reachable. |
| `Illustration`                                       | A registered raster image (`illustrations.ts`): WebP 1x + `@2x`, intrinsic width/height (no layout shift), lazy by default, `decorative` ⇒ `alt=""`. Sizes `xs/sm/md/lg`. Never carries state or action; never a CSS background. See section 6.                                                                                                                                                                                                                                                        |
| `KanbanBoard`                                        | Drag + keyboard; the floating card is the one real shadow. Dynamic geometry goes through CSS custom properties (`--rail-width`, `--fade-mask`).                                                                                                                                                                                                                                                                                                                                                        |
| `DotMatrix`                                          | Loading indicator; decorative unless given a `label`. Geometry via `--dm-*` variables.                                                                                                                                                                                                                                                                                                                                                                                                                 |

## 5. Patterns

- **Screen:** `.blue-screen` (grid, 24px gap) → `.blue-screen-head` (title, subtitle, one action) →
  content. Title is the page `<h1>`. Onboarding caps its container at 1300px.
- **Panel:** `.blue-panel` white, 1px `rule-soft`, `radius-lg`, 16px pad; `.blue-panel-soft` for the one
  informational panel (accent-soft). Panel head = `h2` + optional count/link.
- **Empty state:** one `Illustration` (decorative when the title already says it, else described),
  one sentence in the title, optional one-line description, **at most one action**. Dashed `rule`
  box when it replaces a list; borderless (`quiet`) inside a section that has its own heading.
  Every list/detail screen handles loading, empty, populated and error explicitly.
- **Dialog:** title (`h2`, `labelledBy`), fields in a column with 16px gap, `ModalFooter` with Cancel
  (secondary) then the primary. Errors inline under the field and summarised in a live region.
- **Form:** vertical labels above fields, hint below, required marked in the label text. Native
  controls (checkbox, radio) take `accent-accent` rather than an arbitrary `accent-[var(--color-accent)]`.
- **Status:** chip/dot per section 1; the chip always contains the status word.
- **Navigation:** navy `shell` rail on ≥ 768px, bottom bar below; the active item is `aria-current`.

## 6. Imagery

One illustration family: raster, transparent, blue/white, no text, no logos, no people, one subject
per image with a faint orbit ring. Generated (company Codex image tool) and exported by
`scripts/optimize-assets.mjs` from 1280×800 PNG masters to `<name>.webp` (640 px) and
`<name>@2x.webp` (1280 px); backgrounds are 1920 px single files. The registry is the contract: a name
that is not in `illustrations.ts` does not type-check. Placement table and provenance (source,
style family, master SHA-256, bytes): `docs/ux-research/BLUE_ASSET_MANIFEST.md`.

- **Masters stay out of the repo.** Only the exported WebP ships in `public/campus-blue-assets`; the
  manifest's SHA-256 pins the exact PNG each file came from.
- **Raster vs provisional.** 17 slots are raster (STYLE-A, Nov 2026). The rest still ship the
  provisional SVG and are flagged `vector: true` in the registry, so `<Illustration>` serves `.svg`
  for them. When a master lands: run the script, drop the flag; the registry test fails if a file the
  registry points at is missing.
- **Mount through `<Illustration>`**, never a hand-written `<img src="/campus-blue-assets/…">`: it
  sets intrinsic `width`/`height` (no layout shift), `srcset` 1x/2x, lazy loading (pass `eager` only
  above the fold) and the alt policy (`decorative` when the heading already says it).

Rules: one spot illustration per panel, 176–240px on 390 and 220–300px on 1440, never above the
primary action's fold; backgrounds are decorative (`alt=""`) and sit behind opaque panels.

## 7. Accessibility floor (non-negotiable)

Semantic landmarks · real `<button>`/`<a>` · every control has an accessible name · visible focus
everywhere (2px `focus` ring) · dialogs trap and restore focus · live regions for async feedback ·
`prefers-reduced-motion` honoured · colour never the only signal · contrast per section 1 (tested).

## 8. Enforcement

| Check                      | Command                                                                              | State                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types, ESLint              | `pnpm typecheck`, `pnpm lint`                                                        | Required.                                                                                                                                                                   |
| Contrast of shipped tokens | `pnpm vitest run src/lib/design`                                                     | Required.                                                                                                                                                                   |
| Design-system audit        | `pnpm lint:shadcn`                                                                   | **Opt-in**, see `SHADCN_LINT_BASELINE.md`. Rules: `no-raw-colors`, `no-arbitrary-values`, `no-inline-styles`, `no-unknown-classes`, `require-static-classes`, `no-restyle`. |
| Visual regression          | `node scripts/design-shots.mjs` then `node scripts/design-diff.mjs <before> <after>` | Screenshots 17 screens × 3 viewports against a real temp Vault; shift-tolerant and structural diff.                                                                         |

**Dynamic-value exceptions** (audit config): per-frame animation styles (`DotMatrix` resolver) and
framer-motion `MotionValue`s (Kanban drag overlay) cannot be static classes; they are the only
approved inline styles. Everything else dynamic goes through a CSS custom property plus a utility
(`rail-thumb`, `dot-matrix-grid`, `mask-fade-x`).

## 9. Known debt (explicit, not hidden)

- **Warm oklch + dark layer** still in `@theme` for the accent derivation; retire with
  `lib/design/palette.ts` when personalisation is decided.
- **Spacing literals** in the blue sheets (~67 `gap`, plus paddings: 40 distinct) are not yet on the
  4px grid; normalising them moves layout by ≤ 2px, so it needs its own visual pass.
- **Type literals:** 46 `font-size` literals remain in the blue sheets, those further than 0.25px
  from a scale step (e.g. `0.86rem`, `0.9rem`, `2.05rem`); snapping them reflows text.
- **Audit findings outside `src/styles` and `src/components/ui`:** tracked in
  `SHADCN_LINT_BASELINE.md`; most are one-class swaps (`tracking-[0.12em]` → `tracking-eyebrow`,
  `ease-[var(--ease-out-quiet)]` → `ease-out-quiet`, `accent-[var(--color-accent)]` → `accent-accent`)
  in screens owned by other threads.
