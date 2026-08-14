# campus-poc-foundation — Tasks

Every task declares the PRD requirement(s) it implements. Requirement IDs come from
`docs/PRD.md` §8 and are never renumbered.

## Foundation

- [x] **T-01** — Repo, toolchain, strict TypeScript, Tailwind v4 tokens, quality scripts
      _implements:_ infrastructure for all
      _evidence:_ `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`

- [x] **T-02** — Project skills (`campus-product`, `campus-design-system`, `campus-frontend`,
      `campus-supabase`, `campus-quality`, `campus-academic-data`)
      _implements:_ doctrine for all
      _evidence:_ six `SKILL.md` files with valid frontmatter under `.claude/skills/`

## Data & backend

- [x] **T-03** — Academic reference schema (institutions → academic_units → programs →
      curricula → subjects → curriculum_subjects → prerequisites), recursive academic units,
      provenance columns on `curricula`
      _implements:_ CAP-ONBOARD-001, CAP-PLAN-001, CAP-PLAN-003
      _evidence:_ `supabase/migrations/20260814000100_academic_reference.sql`

- [x] **T-04** — User-owned schema (profiles, user_academic_contexts, user_subject_states,
      academic_items, resources) with four RLS policies per table and `with check` on update
      _implements:_ CAP-ONBOARD-001, CAP-ONBOARD-002, CAP-CAPTURE-001, CAP-RESOURCE-001
      _evidence:_ `supabase/migrations/20260814000200_user_data.sql`

- [x] **T-05** — Explicit privilege grants for `anon` / `authenticated` / `service_role`
      _implements:_ security baseline for all user-facing requirements
      _evidence:_ `supabase/migrations/20260814000300_grants.sql`

- [x] **T-06** — A/B RLS isolation tests with real JWTs and the anon key
      _implements:_ PRD §13 security
      _evidence:_ `pnpm test:db` → 15/15 passed

- [x] **T-07** — Official curriculum research (UTN FRRo ISI Plan 2023 with 186 correlativas;
      UNR FCEIA LCC TO 2024) and deterministic seed generation
      _implements:_ CAP-PLAN-001, CAP-PLAN-003, PRD §10 provenance
      _evidence:_ `docs/research/academic-sources.md`, `docs/research/curricula/*.json`,
      `scripts/generate-seed.mjs` → `supabase/seed.sql`

## Domain

- [x] **T-08** — `computeSubjectViews` — availability derived from the prerequisite graph in
      the domain layer, not in React
      _implements:_ **CAP-PLAN-002**
      _evidence:_ `src/domain/availability.test.ts` (14 tests)

- [x] **T-09** — `computeProgress` / `activeSubjects`
      _implements:_ CAP-PLAN-001
      _evidence:_ `src/domain/progress.test.ts` (6 tests)

- [x] **T-10** — `buildAgenda` / `itemsInRange` / `weekDays` — DST-safe local-day bucketing
      _implements:_ CAP-TODAY-001, CAP-CALENDAR-001
      _evidence:_ `src/domain/agenda.test.ts` (16 tests)

- [x] **T-11** — Accent- and case-insensitive `search`
      _implements:_ CAP-SEARCH-001
      _evidence:_ `src/domain/search.test.ts` (10 tests)

## Frontend

- [x] **T-12** — Design tokens, typography, focus styles, reduced-motion, editorial surface
      language
      _implements:_ `docs/design.md`
      _evidence:_ `src/styles/globals.css`, screenshots under `evidence/ui/`

- [x] **T-13** — `AcademicShell`, desktop nav, mobile bottom nav, context rail slot
      _implements:_ CAP-RESPONSIVE-001
      _evidence:_ `verify:ui` at 360/390/768/1280/1440

- [x] **T-14** — Onboarding cascade + unmapped escape hatch
      _implements:_ CAP-ONBOARD-001, CAP-ONBOARD-002
      _evidence:_ `verify:journey` steps 2–6

- [x] **T-15** — Today screen: overdue / today / next / cursando / progress
      _implements:_ CAP-TODAY-001
      _evidence:_ `verify:journey` step 12

- [x] **T-16** — Plan screen grouped by year with status glyphs and provenance footer
      _implements:_ CAP-PLAN-001, CAP-PLAN-003
      _evidence:_ `verify:journey` steps 7–8

- [x] **T-17** — Course list with filters and course detail (status, deadlines, correlativas,
      resources)
      _implements:_ CAP-COURSE-001, CAP-PLAN-002, CAP-RESOURCE-001
      _evidence:_ `verify:journey` steps 9, 11, 16–19

- [x] **T-18** — Quick capture reachable from any screen (Cmd/Ctrl+K, mobile FAB)
      _implements:_ CAP-CAPTURE-001
      _evidence:_ `verify:journey` step 10

- [x] **T-19** — Calendar week/agenda view
      _implements:_ CAP-CALENDAR-001
      _evidence:_ `verify:journey` step 13

- [x] **T-20** — Library (links + notes)
      _implements:_ CAP-RESOURCE-001
      _evidence:_ `evidence/ui/*/library-*.png`

- [x] **T-21** — Search palette as an ARIA combobox
      _implements:_ CAP-SEARCH-001
      _evidence:_ `src/features/search/search-palette.tsx`, a11y scan clean

- [x] **T-22** — Settings + privacy statement
      _implements:_ PRD §13
      _evidence:_ `evidence/ui/*/settings-*.png`

## Verification

- [x] **T-23** — `verify:ui` — 6 routes × 5 viewports, render/console/overflow/screenshot
      _implements:_ CAP-RESPONSIVE-001
      _evidence:_ 30/30 passed

- [x] **T-24** — `verify:a11y` — axe-core, blocks on critical or serious
      _implements:_ CAP-A11Y-001
      _evidence:_ critical=0 serious=0 moderate=0 minor=0 across 12 scans

- [x] **T-25** — `verify:journey` — the full success condition through the real UI
      _implements:_ PRD §17 POC release definition
      _evidence:_ 20/20 steps

- [x] **T-29** — Tester tooling: six seeded scenarios (`pnpm tester`) + a flag-gated `/dev`
      route with one-click login, covering the states blocked by missing academic data
      _implements:_ testability for CAP-ONBOARD-002, CAP-PLAN-001, CAP-PLAN-003
      _evidence:_ `docs/TESTING.md`, `pnpm tester list`

- [x] **T-30** — `verify:frontend` — 39 surfaces × 5 viewports with axe-core on every one,
      scenarios in parallel, headed inside a display pinned to `:99`
      _implements:_ CAP-RESPONSIVE-001, CAP-A11Y-001 beyond the six main routes
      _evidence:_ 195/195, a11y 0 at every impact

- [x] **T-31** — Honest degradation when a curriculum declares no correlativas: Plan and the
      materia detail say the faculty has not published them instead of letting silence read as
      "nothing blocks you"
      _implements:_ PRD P-05 applied to absent data
      _evidence:_ `evidence/frontend/*/plan-unr-sin-correlativas-*.png`

## Known gaps

- [ ] **T-26** — UNR FCEIA correlativas: not published in the Texto Ordenado 2024
      ("serán aprobados oportunamente por el Consejo Directivo"). Recorded as a gap, deliberately
      **not** backfilled from the superseded Plan 2010, whose subject codes were renumbered.
- [ ] **T-27** — File upload for resources. Schema has `storage_path`; the UI does not offer
      upload until owner/size/content-type/path validation is proven.
- [ ] **T-28** — UTN elective blocks and Práctica Profesional Supervisada carry
      `verified: false` (level/term not documented in the Ordenanza).
