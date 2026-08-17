# Workspace design — visual & interaction authority

**Direction:** editorial academic notebook × powerful desktop workspace. Quiet, dense when
useful, academic, tactile, warm. Paper, marginalia and index-card influence carried by
typography, rules and rhythm — **never** by fake paper textures, grain overlays or skeuomorph
shadows.

**Named anti-patterns.** These are rejected on sight, not debated per-screen: the generic
SaaS dashboard; giant stat cards; the purple-gradient startup look; the shadcn-demo default
look; everything-rounded; the dashboard-with-sidebar cliché where a nav column of icons
frames a grid of cards. Campus is a notebook with a workspace around it, not a dashboard
with notes inside it.

## Design principles

1. **The note is the interface.** Implication: chrome never competes with the editor column
   for contrast, size or motion — chrome uses `ink-muted` and small sizes by default.
2. **Paper, never pure white.** Implication: every surface is a `paper-*` token; `#fff` and
   `#000` never appear in components.
3. **One accent, spent deliberately.** Implication: `accent` marks the current action,
   selection and links — never decoration, never a second brand color per Materia.
4. **Structure comes from rules, not shadows.** Implication: panes, rows and sections are
   separated by `rule`/`rule-soft` borders; elevation is reserved for true overlays.
5. **Dense when useful, calm by default.** Implication: lists tighten to 40px rows under
   density or small viewports, but the default rhythm keeps 12px of breathing room per row.
6. **Honest about unknowns.** Implication: unknown academic data (e.g. `prerequisitesKnown:
false`) is rendered as explicit text — "correlativas no publicadas" — never as an empty
   state, a gray dot, or silence.
7. **Keyboard-first, mouse-complete.** Implication: every palette action has a pointer path
   and every pointer action has a palette entry; neither modality is second-class.

## Layout model

Left to right: **rail → sidebar/explorer → pane group → (optional) status bar** (status bar
spans the bottom).

- **Rail** — 48px icon strip: vault switcher, Today, Materias, search, settings. Always the
  same order; no badges except a plain count.
- **Sidebar / explorer** — `--spacing-rail` (260px): file tree or contextual explorer
  (backlinks, TOC, materia info). Collapsible; its state is per-device (`layouts.json`).
- **Pane group** — the workspace. Panes hold tabs (VS Code editor-group model: drag to
  split, preview tabs in italic). The editor column inside a pane is centered at its
  measure regardless of pane width.
- **Status bar** — optional 28px strip: left = vault + materia context, right = save state,
  word count, mode. Passive; it never animates for attention.

**Responsive breakpoints (exact):**

| Viewport   | Layout                                                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 1200px   | Full workspace: rail + sidebar + multi-pane group + status bar                                                                                                                                      |
| 768–1199px | Rail + collapsible sidebar (overlay when open), 1–2 panes max                                                                                                                                       |
| < 768px    | Single pane; sidebar, palette and explorers become bottom sheets; rail collapses to a top bar. **360px is first-class**, not a degraded afterthought — every screen is designed at 360 before 1440. |

## Token roles

`src/styles/globals.css` is the source of truth. Roles map onto the **existing** names;
extend the palette only through this table, never by hardcoding hex in components.

| Role                       | Token                                                | Notes                                                                           |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Background                 | `--color-paper`                                      | App and pane background                                                         |
| Surface                    | `--color-paper-elevated`                             | Cards, popovers, hovered rows                                                   |
| Surface (sunken)           | `--color-paper-sunken`                               | Wells, inputs, **code background**                                              |
| Surface (raised)           | `--color-paper-elevated` + `--color-rule` border     | "Raised" is border + background shift, not shadow                               |
| Border                     | `--color-rule`                                       | Structural separation                                                           |
| Border (soft)              | `--color-rule-soft`                                  | Row separators, quiet grouping                                                  |
| Border (strong)            | `--color-ink-muted` at 1px                           | New role, no new token: use sparingly for emphasized containers                 |
| Ink                        | `--color-ink`                                        | All primary text                                                                |
| Ink (muted)                | `--color-ink-muted`                                  | Metadata, secondary text — the _only_ second text tier (AA rule in globals.css) |
| Ink (decorative)           | `--color-ink-faint`                                  | Glyphs, chevrons, placeholders. **Never text.**                                 |
| Accent                     | `--color-accent` / `-soft` / `-ink`                  | Links, selection, focus, primary action                                         |
| Success / warning / danger | `--color-{success,warning,danger}` + `-soft`         | Academic status; always paired with text (see interaction states)               |
| Selection                  | `--color-accent-soft` bg + `--color-accent-ink` text | Already wired via `::selection`                                                 |
| Focus                      | `--color-accent` 2px outline, 2px offset             | Already wired via `:focus-visible`; never removed                               |

**Additions allowed:** an overlay scrim token (`--color-scrim`, ink at ~40% alpha) for
sheets/modals, and a drag-indicator role reusing `--color-accent`. Nothing else without
updating this file.

## Typography roles

Inter for interface, Newsreader (serif) for display and editor prose. Sizes reference the
`--text-*` scale in globals.css.

| Role            | Face               | Size                                   | Use                                                  |
| --------------- | ------------------ | -------------------------------------- | ---------------------------------------------------- |
| Display         | Newsreader 500     | 1.75rem (`text-2xl`)                   | Page titles, the Today greeting                      |
| Section         | Inter 600          | 0.8125rem (`text-sm`), tracked +0.02em | Section headings, sidebar group labels               |
| Body            | Inter 400          | 0.9375rem (`text-base`)                | Interface prose, list rows                           |
| Metadata        | Inter 400          | 0.75rem (`text-xs`), `ink-muted`       | Dates, counts, subject tags; tabular-nums in columns |
| Mono            | ui-monospace stack | 0.8125rem                              | Inline code, file paths, IDs                         |
| **Editor body** | Newsreader 400     | 1.0625rem (`text-lg`), line-height 1.6 | Note prose                                           |

**The editor body is the most-read text in the app.** It gets the largest comfortable size,
the serif, and a fixed measure of **~46rem (≈70ch)** centered in its pane (iA Writer rule) —
`--spacing-measure` (52rem) is the outer notebook surface, the prose column sits inside it.
No other text role may exceed the editor body in visual weight on an editing screen.

## Spacing rhythm

4px base unit. Canonical steps: **4 / 8 / 12 / 16 / 24 / 36**.

- Row padding: 12px vertical (dense: 8px). Pane gutters: 16px (≥1200: 24px).
- Section gap: 36px (`gap-9`, as `today.tsx` already does). Related-group gap: 4–8px.
- Off-scale values require a comment at the use site explaining why.

## Radius scale

Existing tokens: `sm` 6px, `md` 8px, `lg` 12px, `xl` 16px.

- Controls (buttons, inputs, tags): `sm`–`md`. Popovers, cards: `lg`. Sheets, modals: `xl`.
- **List rows and table rows are square** — separated by `rule-soft` borders, not rounded
  containers. Rounding everything is a named anti-pattern; radius signals "floats above the
  page", and rows don't float.
- Full pills only for the smallest count badges and status glyphs.

## Shadow policy

Almost none. **Borders carry structure.**

- Allowed: one small shadow (`0 1px 2px rgb(24 24 22 / 0.12)`, as `.skip-link`) on true
  overlays only — popovers, sheets, drag ghosts, the palette.
- Forbidden: shadows on cards, rows, headers, sidebars, buttons, or anything at rest in the
  page plane. If a resting element needs separation, it needs a border or a `paper-*` shift.

## Motion policy

- Controls: **120–180ms**. Panels, sheets, palette: 180–240ms. Easing: `--ease-out-quiet`.
- Motion communicates state change (open, dismiss, reorder) — never idle decoration, never
  looping, never parallax.
- `prefers-reduced-motion` is already honored globally (globals.css zeroes durations); no
  component may opt out of it.

## Empty states & illustration language

Editorial line-art, drawn not photographed: **books, folders, index cards, graph-paper
fragments, marginalia scribbles.**

- Inline SVG, stroke-based, **`currentColor`** so every illustration is theme-aware; render
  at `ink-faint`.
- Small: ≤ 96px, sitting above one sentence of copy and at most one action (the
  `EmptyState` component pattern).
- Decorative: `aria-hidden="true"`, never the carrier of meaning — the text states the
  situation ("Todavía no elegiste tu carrera") and the action names the exit.
- No mascots, no 3D blobs, no stock illustration packs, no gradients.

## Interaction states

| State            | Treatment                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hover            | Background shifts to `paper-elevated`; no color change on text; 120–180ms                                                                                         |
| Focus            | `:focus-visible` 2px `accent` outline, 2px offset — global, never removed                                                                                         |
| Active (pressed) | Background `paper-sunken`; no scale transforms                                                                                                                    |
| Selected         | `accent-soft` background + `accent-ink` text, or a 2px `accent` left rule on rows; selection persists visibly when the pane loses focus (muted to `paper-sunken`) |
| Drag             | Source at 50% opacity; a 2px `accent` drop-indicator line between targets; drag ghost may use the one allowed overlay shadow                                      |
| Disabled         | `ink-faint` on unchanged background; cursor default; still focusable when it can explain _why_ it is disabled                                                     |

**Text before color — the hard rule.** Academic state is never carried by color alone:
every status color pairs with a word or glyph-plus-label ("Aprobada", "Regular", "Atrasada"),
and **unknown data is stated in text** — `prerequisitesKnown: false` renders "correlativas
no publicadas", never a blank, never a gray badge a colorblind or rushed student must
decode. Color is reinforcement; text is the information.
