---
name: campus-design-system
description: Campus visual doctrine — editorial/notebook aesthetic, design tokens, typography scale, spacing, responsive rules, component inventory and reuse order, empty-state tone. Use before writing ANY UI, choosing a colour, adding a card, styling a screen, or reviewing a design. Warns against generic SaaS, gradients, glassmorphism and stock shadcn leakage.
---

# Campus — design system

Authoritative source: `docs/design.md`. Visual research: `docs/research/visual-reference-notes.md`.

## Thesis

> **Campus must feel like opening an extremely well-organised university notebook — not like
> entering a university's administrative portal.**

Metaphor: **academic field notebook + quiet operations desk.**

Keywords: editorial · quiet · tactile · academic · dense-but-readable · notebook · structured ·
warm · precise · personal.

## Banned aesthetics — treat as review-blocking

- generic SaaS landing look (hero gradient + three feature cards)
- neon or multi-stop gradients anywhere
- glassmorphism / backdrop blur as decoration
- giant KPI number cards
- gaming/analytics dashboard density
- "AI sparkle" aesthetic (✨, glowing borders, purple-to-blue)
- corporate LMS chrome
- juvenile school aesthetic (mascots, crayon icons, confetti)
- **stock shadcn leakage** — untouched `bg-card border rounded-lg shadow-sm` cards everywhere,
  default zinc/slate palette, default `Button` variants unchanged. shadcn is a starting
  skeleton; it must be re-skinned to Campus tokens before it ships.

## Tokens — the only source of colour

Defined in `src/styles/tokens.css` as CSS custom properties, exposed to Tailwind via
`@theme`. **Never hardcode a hex value in a component.**

```css
--paper: #f7f5ef; /* app background — warm paper, never pure white */
--paper-elevated: #fffefa; /* raised surfaces */
--ink: #181816; /* primary text — near-black, never #000 */
--ink-muted: #6a6862; /* secondary text, metadata — 5.11:1 on paper */ /* secondary text, metadata */
--rule: #dedbd2; /* borders, separators */
--rule-soft: #ebe8df; /* hairlines inside a surface */
--accent: #3157d5; /* single accent — links, focus, active state */
--accent-soft: #e7ecfb; /* accent background wash */
--success: #36745b; /* passed */
--warning: #9b6427; /* due soon */
--danger: #a3423d; /* overdue, failed */
```

One accent. If a screen seems to need a second accent colour, it needs better hierarchy instead.

### There are exactly TWO text colours

`--ink` and `--ink-muted`. There is no third tier, and trying to invent one is a
recurring mistake: any value light enough to read as "fainter" than `--ink-muted` on
`--paper` fails 4.5:1, and any value that passes collapses back into `--ink-muted`.

`--ink-faint` is **not a text colour**. Use it only for decorative glyphs, chevrons,
separators and input placeholders. If you are about to put it on something a person reads,
use `--ink-muted`.

Same trap with opacity: `opacity-70` on white over `--accent` composites to 3.84:1 and
fails. Dimming text is a contrast decision, not a styling one — check it.

## Typography

- **UI/utility:** Inter Variable
- **Editorial:** Newsreader (serif) — used _selectively_ for page titles, the date on Today,
  and important moments. Never for body copy, never for buttons, never for table data.

Scale (rem): `0.75 · 0.8125 · 0.875 · 1 · 1.125 · 1.375 · 1.75 · 2.25`.
Body line-height 1.5; headings 1.2. Numerals: `font-variant-numeric: tabular-nums` on
anything in a column (times, grades, counts).

## Surface language

Prefer a **paper-like main surface with thin separators**, with occasional elevated cards.
**Avoid card-everything UI** — this is the single most common failure mode.

- A list of things is a list of **rows separated by hairlines**, not a stack of cards.
- Reach for a card only when the object is genuinely a discrete unit the user acts on as a whole.
- Radii: `8 / 12 / 16px`. Shadows: subtle and rare — prefer `border + surface contrast`.
- Active/selected row: a **2px accent rule on the leading edge**, not a filled background block.

## Layout

Desktop ≥1200px:

```text
┌────────────┬──────────────────────────────┬───────────────┐
│ navigation │ main notebook surface        │ context rail  │
│ 220px      │ max 760–900px                │ 260px         │
└────────────┴──────────────────────────────┴───────────────┘
```

- **Tablet (768–1199):** nav collapses to icon rail or drawer; context rail becomes inline or a drawer.
- **Mobile (<768):** top context strip, main content, bottom nav, prominent quick capture.

**Mobile first: design and verify 360–390px before tablet or desktop.** Mobile is not a
compressed desktop (P-08).

## Spacing & density

4px base. Vertical rhythm inside a section: `8 / 12 / 16`; between sections: `32 / 48`.
Dense but readable — a Today screen with 6 items should not require scrolling on a 390px phone.

## Motion

Controls 120–180ms, panels 180–240ms, ease-out. Respect `prefers-reduced-motion: reduce` —
reduce to opacity-only or none. No entrance animations on data lists.

## Focus & a11y

Visible focus ring on every interactive element: `2px solid var(--accent)` with `2px` offset.
Never `outline: none` without a replacement. Colour is **never the only carrier** of state —
subject status uses a glyph + text label alongside colour. Tap targets ≥44×44px on mobile.

## Iconography

**Lucide only.** Icons support text, they do not replace it. No icon-only buttons without an
accessible name.

## Component inventory — standardise these early

`AcademicShell` · `PageHeader` · `SectionHeading` · `AcademicStatus` · `SubjectRow` ·
`SubjectCard` · `DeadlineRow` · `DaySection` · `QuickCapture` · `EmptyState` · `ProgressLine` ·
`MetadataList` · `ResourceRow` · `MobileBottomNav` · `ContextRail`

## Reuse order — mandatory before authoring anything

```text
project components → shadcn registry → configured external registry → create new
```

Run `node ~/Documents/GitHub/developer-harness/src/cli/index.mjs component "<intent>" --json`
before authoring a UI primitive. If it says `reuse`, reuse.

## Subject status glyphs

| Status      | Glyph          | Colour token  |
| ----------- | -------------- | ------------- |
| passed      | ✓              | `--success`   |
| in_progress | ●              | `--accent`    |
| regularized | ◐              | `--accent`    |
| available   | ○              | `--ink`       |
| pending     | ◌              | `--ink-muted` |
| blocked     | 🔒 (lock icon) | `--ink-muted` |
| failed      | ✕              | `--danger`    |
| equivalent  | ≡              | `--success`   |

Always render glyph + Spanish label, not colour alone.

## Copy tone

UI language: **Spanish (Argentina)**, voseo where natural. Clear, warm, short. Not
infantilizing, not corporate, no forced slang, no productivity/AI hype.

Good: `¿Qué tenés para hoy?` · `Próximamente` · `Tu plan` · `Agregar entrega` ·
`No tenés nada para hoy.`

Empty states: no mascot, direct academic language.

> No tenés nada para hoy. Buen momento para adelantar algo, o para no hacer nada.

## Target emotional response

> "I know what is going on."

Not:

> "I have another productivity system to maintain."
