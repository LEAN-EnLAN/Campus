# Campus Notebook Redesign — 48h plan

Evidence-driven. Every claim below was measured from the running app on
2026-09-12 (headless capture at 1440×900 and 390×844, DOM geometry read from
the live page), not eyeballed from code.

## The measurement that explains almost everything

```
viewport 1440
app sidebar   x=0    w=220   ends 220
main          x=409  w=832   ends 1241
              ──────────────────────────
dead left gutter   189px
dead right gutter  199px
total dead         388px = 27% of the viewport
```

`main` is a centred 832px reading column. That is CORRECT for Today, Plan and
Courses, which are editorial prose. It is applied to the workspace too, and
that single inherited constraint causes:

- The file explorer renders INSIDE the prose column (`x=409 w=287`), so it
  floats unattached in the middle of the screen instead of being a rail.
- Split panes get ~416px each, minus the notebook card's 4rem margin, leaving
  **~170px of usable text**. At 1440px the note title wraps over two lines and
  a `np.array([[1, 2], [3, 4]])` breaks mid-expression.
- 27% of a 1440px screen is permanently blank while the editor suffocates.

**This is the highest-leverage fix in the entire redesign.** The workspace must
escape the prose container and own full bleed; the _note page_ inside it gets a
measure, which is a different thing entirely.

## What is actually wrong, ranked by damage

### P0 — Raw Markdown syntax is visible at all times

The editor shows `---`, `title:`, `tags:`, `# `, `## `, `- [ ]`, ` ```python `.
Eight lines of YAML frontmatter open every note before a single word of
content. Notion, Obsidian live-preview and AFFiNE all hide the marks on lines
the cursor is not on. This is the difference between "a Markdown textarea" and
"a notebook", and it is the main reason the product reads as developer UI.

### P0 — Workspace trapped in the prose column

See measurement above.

### P0 — Mobile workspace opens unusable

At 390px the explorer sheet defaults to open and covers 73% of the screen; the
editor behind shows the fragment `ices]].`. `sidebarOpen` initialises to `true`
regardless of viewport.

### P1 — "Calendario" is not a calendar

It is Today with different grouping: a vertical agenda list, no grid, no week
columns, no time axis, no month view. Below the last item, ~60% of the vertical
space is empty. It reads as the cleanest screen only because it is the emptiest.

### P1 — The notebook skin is decoration, not structure

`workspace-shell.tsx:326` already paints ruled lines every 1.75rem and a margin
rule at 4rem. But the text does not sit ON the rules — the editor's line-height
(1.7 × 0.9375rem ≈ 1.59rem) is not locked to the 1.75rem ruling, so lines drift
across the paper. A ruled page whose text ignores the rules looks like a bug.

### P1 — Deadline times are noise

Every item renders `16:10` because every seeded deadline carried a timestamp.
A due date with no meaningful time should show no time. Eight identical clock
readings down a column is worse than no clock at all.

### P2 — Palette breaks its own rules

The sidebar's `Agregar` is a saturated blue block and the mobile FAB is a blue
circle, in an otherwise warm paper/ink palette. `Ver el calendario` is a raw
blue link. These are the only blues on screen and they read as unstyled.

### P2 — Empty-state checkboxes are heavy

Large hollow circles at the left of every row pull more attention than the task
titles they belong to.

## Direction

> **Layout and craft from AFFiNE. Editing ergonomics and speed from QOwnNotes.
> Notebook cell mechanics from srcbook. Our own paper/ink identity throughout.**

Non-negotiable: we keep our fonts, our warm palette, our Spanish voice, and
local-first Markdown-on-disk. We copy _proportions, affordances and behaviour_,
never visual identity, and never copyleft code.

## Blocks (each ≈ one reviewable candidate)

| #   | Block                       | Outcome                                                                                                                                                  |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Escape the prose column** | Workspace owns full bleed; explorer becomes a real rail attached to the app sidebar; note page gets its own measure. Split panes become usable at 1280+. |
| B2  | **Live-preview Markdown**   | CM6 decorations hide syntax marks off-cursor: headings, emphasis, links, wikilinks, task checkboxes as real checkboxes, fenced code as a framed block.   |
| B3  | **Properties panel**        | Frontmatter collapses into a compact properties strip under the title; round-trips byte-identically when untouched.                                      |
| B4  | **The page, for real**      | Baseline grid locked to the ruling; title as an editable H1 field; page padding/shadow/edges tuned; dark mode that does not look like inverted paper.    |
| B5  | **QOwnNotes keymap**        | Bold/italic/code, heading up/down, list continuation, Tab indent/outdent in lists, checkbox toggle, move/duplicate line, smart paste URL-over-selection. |
| B6  | **A real calendar**         | Month grid + week view with a time axis, deadlines as chips, today marked, click-through to Course/note. Agenda list stays as the mobile view.           |
| B7  | **Mobile workspace**        | Sidebar closed by default under 768px; editor first; navigation reachable without covering content.                                                      |
| B8  | **Palette + density pass**  | Kill stray blues, right-size checkboxes, tighten section rhythm, comfortable/compact density.                                                            |
| B9  | **Verification**            | Extend the headless sweep to the new surfaces; axe stays 0/0/0/0; performance re-measured; visual review of captures.                                    |

## Sequencing

B1 first and alone — it changes the frame every later block is judged inside,
and reviewing B2 against a 170px pane would be reviewing the wrong thing.
Then B2+B3+B4 (the page), then B5 (hands), then B6/B7 (surfaces), B8/B9 last.

## Out of scope

Code execution, Pyodide, sync/CRDT, plugin system, AI. Seams only, per Prompt 3.
