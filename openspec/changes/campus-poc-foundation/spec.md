# campus-poc-foundation — Spec

Requirements are the PRD's, verbatim by ID. Each carries the scenarios that must hold and
the evidence that shows they do.

---

## CAP-ONBOARD-001 — Academic context selection

Select institution → academic unit → program → curriculum. Persisted, resumable, editable,
not hardcoded.

- **GIVEN** a signed-up student with no academic context
  **WHEN** they open any protected screen
  **THEN** they are routed to `/onboarding`
- **GIVEN** the onboarding screen
  **WHEN** they pick an institution
  **THEN** only that institution's academic units are offered, and the same cascades to
  programs and curricula
- **GIVEN** a completed selection
  **WHEN** they confirm
  **THEN** exactly one active `user_academic_contexts` row exists for them (enforced by a
  partial unique index, not by application code)
- **GIVEN** an existing context
  **WHEN** they run onboarding again
  **THEN** the previous context is deactivated and a new active one is created

_Evidence:_ `verify:journey` steps 1–6; `tests/db/rls.test.ts`.

---

## CAP-ONBOARD-002 — Unmapped academic context

Continue even when the plan is unavailable.

- **GIVEN** a student whose plan Campus does not have
  **WHEN** they choose "No encuentro mi carrera" and describe it
  **THEN** the context is stored with `unmapped_label` and `curriculum_id = null`
- **GIVEN** an unmapped context
  **WHEN** they open Plan
  **THEN** they see an explicit "todavía no tenemos tu plan" state, **not** an empty grid
  pretending to be a curriculum
- **AND** Today, Calendar and Library keep working

_Constraint:_ `user_academic_contexts_resolvable` — a row must carry either a
`curriculum_id` or an `unmapped_label`.

---

## CAP-TODAY-001 — Today prioritises today

- **GIVEN** items overdue, due today, tomorrow and next week
  **WHEN** Today renders
  **THEN** overdue and today appear first, and tomorrow/next week appear under
  "Próximamente" — visible, not hidden
- **GIVEN** no items today
  **THEN** the heading reads "No tenés nada para hoy." with a non-apologetic empty state
- **GIVEN** an item at 23:00 and "now" at 01:00 the next day
  **THEN** bucketing is by local calendar day, so a DST shift cannot move an item between
  buckets

_Evidence:_ `src/domain/agenda.test.ts` (16 tests); `verify:journey` step 12.

---

## CAP-CAPTURE-001 — Capture from anywhere

- **GIVEN** any protected screen
  **WHEN** the student presses Cmd/Ctrl+K, or taps the mobile capture button
  **THEN** a focus-trapped dialog opens with the title field focused
- **GIVEN** a date with no time
  **THEN** the item is due at 23:59 local, not 00:00
- **GIVEN** Escape or the backdrop
  **THEN** the dialog closes and focus returns to where it was

_Evidence:_ `verify:journey` step 10; a11y scan clean.

---

## CAP-PLAN-001 — Plan grouped by year

- **GIVEN** a mapped curriculum
  **THEN** subjects are grouped ascending by `year_level` and ordered by `display_order`
- **AND** every subject shows a status **glyph and a Spanish label**, so colour is never the
  only carrier
- **AND** the plan footer links the official source and retrieval date

_Evidence:_ `verify:journey` step 7 (40 subjects, UTN Plan 2023).

---

## CAP-PLAN-002 — Availability recalculates in the domain

**The load-bearing requirement.**

- **GIVEN** subject B requires subject A "para cursar"
  **WHEN** A is untouched
  **THEN** B is `blocked` and names A as missing
- **WHEN** A is marked `passed`
  **THEN** B becomes `available` **without any component recomputing it** — the derivation
  is `src/domain/availability.ts`, importable in a plain Node test with zero mocks
- **GIVEN** B requires both A and C
  **WHEN** only A is passed
  **THEN** B stays `blocked` — partial satisfaction never unlocks
- **GIVEN** A is `regularized`
  **THEN** a `to_take` correlativa is satisfied but a `to_pass` one is not
- **GIVEN** a `recommended` correlativa
  **THEN** it never blocks
- **GIVEN** a stored status that contradicts the graph
  **THEN** the stored status wins and the conflict is surfaced, not overwritten
- **GIVEN** a dangling prerequisite edge
  **THEN** it is ignored rather than freezing the student's plan

_Evidence:_ `src/domain/availability.test.ts` (14 tests); `verify:journey` steps 16–19,
which approve Análisis Matemático I, assert Análisis Matemático II is **still** blocked by
Álgebra y Geometría Analítica, then approve Álgebra and assert it flips to available.

---

## CAP-PLAN-003 — Multiple curriculum versions

- **GIVEN** a program with more than one published plan
  **THEN** each is a separate `curricula` row with its own provenance
- **AND** plan versions are never merged, and prerequisites are scoped to curriculum
  subjects so two versions cannot borrow each other's correlativas

---

## CAP-COURSE-001 — Unified subject view

Status, next deadlines, correlativas (requires / unlocks), resources, notes on one screen.

- **GIVEN** a subject
  **THEN** changing "¿Cómo vas?" persists and re-derives the whole plan
- **AND** missing correlativas are listed by name with what is needed (`cursar` / `aprobar`)
- **AND** what the subject unlocks is listed, excluding recommendations

_Evidence:_ `verify:journey` steps 9, 11, 16, 18.

---

## CAP-CALENDAR-001 — Obligations appear in the temporal view

- **GIVEN** an item created from a subject detail screen
  **THEN** it appears in Today and in the calendar week without a reload
- **AND** after a full page reload it is still there — persisted in Postgres, not in React
  state

_Evidence:_ `verify:journey` steps 12–14.

---

## CAP-RESOURCE-001 — Resources attached to subjects

- Links and notes only. `storage_path` exists in the schema; upload is not offered until
  owner/size/content-type/path validation is proven.
- A `resources_has_payload` check constraint rejects a resource that carries nothing.

---

## CAP-SEARCH-001 — Partial-text search

- **GIVEN** the query "matematico"
  **THEN** "Análisis Matemático I" matches — accent- and case-insensitive
- **GIVEN** fewer than two characters
  **THEN** no results are returned
- Prefix matches outrank word-start matches, which outrank mid-word matches; subjects
  outrank items, which outrank resources.

_Evidence:_ `src/domain/search.test.ts` (10 tests).

---

## CAP-RESPONSIVE-001 — No accidental overflow

At 360×800, 390×844, 768×1024, 1280×800 and 1440×900, every primary route must render,
produce no runtime console errors, and satisfy
`document.documentElement.scrollWidth <= clientWidth`.

_Evidence:_ `verify:ui` → 30/30.

---

## CAP-A11Y-001 — Zero critical or serious violations

axe-core against the rendered app, tags `wcag2a wcag2aa wcag21a wcag21aa`, on every route at
one mobile and one desktop viewport. `critical > 0` or `serious > 0` blocks.

_Evidence:_ `verify:a11y` → critical=0 serious=0 moderate=0 minor=0 over 12 scans.
