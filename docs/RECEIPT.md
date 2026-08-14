# Campus POC — evidence receipt

**Date:** 2026-08-14
**Repository:** `/home/pulpo/Documents/GitHub/campus-poc`
**Branch:** `main`
**Commit:** `HEAD` on `main` — _feat: tester tooling + full-frontend sweep under a pinned virtual display_
**Harness candidate:** frozen at HEAD with 0 uncommitted files
**Verification candidate:** `cand_f508d4cb021b` (content hash over `src/`, `supabase/migrations/`, `scripts/`, `index.html`, `package.json`, `vite.config.ts`)

> This document records what was actually executed. Anything not listed here was not
> verified, and is stated as such.

## Deterministic checks

Run via `node ~/Documents/GitHub/developer-harness/src/cli/index.mjs check delivery`.

| Class      | Command             | Result                                          |
| ---------- | ------------------- | ----------------------------------------------- |
| format     | `pnpm format:check` | ✔ exit 0                                        |
| lint       | `pnpm lint`         | ✔ exit 0 (0 errors, 4 `react-refresh` warnings) |
| typecheck  | `pnpm typecheck`    | ✔ exit 0                                        |
| unit tests | `pnpm test`         | ✔ exit 0 — **48 passed** across 4 files         |
| DB / RLS   | `pnpm test:db`      | ✔ exit 0 — **15 passed** against local Postgres |
| build      | `pnpm build`        | ✔ exit 0                                        |

## Database evidence

Local Supabase stack (Docker), migrations applied from scratch by `supabase db reset`,
seeded from `supabase/seed.sql`.

- Tables in `public` **without** RLS enabled: **0**
- Reference tier: `select` only for `anon` / `authenticated`; **no write privilege granted**
- User-owned tier: four separate policies each, `with check` on insert **and** update
- Seeded: 2 institutions · 2 academic units · 2 programs · 2 curricula · 69 subjects ·
  73 curriculum-subject rows · **186 prerequisite edges**

`tests/db/rls.test.ts` uses two real signed-up users with real JWTs and the **anon** key
(never service-role) and asserts, per user-owned table, that user B cannot read, update,
delete or impersonate user A — and that user A can still read her own rows, so the tests
cannot pass under a `USING (false)` policy.

## Academic data provenance

| Institution | Unit                      | Program                                    | Curriculum          | Subjects | Prerequisites     |
| ----------- | ------------------------- | ------------------------------------------ | ------------------- | -------- | ----------------- |
| UTN         | Facultad Regional Rosario | Ingeniería en Sistemas de Información      | Plan 2023           | 40       | 186               |
| UNR         | FCEIA                     | Licenciatura en Ciencias de la Computación | Texto Ordenado 2024 | 33       | 0 (not published) |

Sources, read as actual documents:

- `https://www.frro.utn.edu.ar/26/ingenieria-en-sistemas-de-informacion-utn#utn-887` —
  Ordenanza CSU N° 1877/2022 (diseño curricular) and N° 1878/2022 (correlatividades)
- `https://web.fceia.unr.edu.ar/images/PDF/planes_de_estudio/Plan_LCC_CD_41043_2023_2.pdf` —
  Resolución C.D. N° 850/2023

Retrieved 2026-08-14. Full notes, judgment calls and gaps: `docs/research/academic-sources.md`.

**Declared gaps (not invented around):**

- UNR correlativas are not published in the TO 2024 and were deliberately **not** backfilled
  from the superseded Plan 2010, whose subject codes were renumbered.
- 4 UTN rows (three elective blocks and the Práctica Profesional Supervisada) carry
  `verified: false` — level/term not documented in the Ordenanza.
- UTN terms were derived from FRRo's own 2026 timetables, since the Ordenanza leaves
  anual-vs-cuatrimestral to each Regional. One comisión (2K08) disagrees with the rest.

## Responsive runtime evidence — CAP-RESPONSIVE-001

`pnpm verify:ui` — Playwright + Chromium against the built app and the real database.

**30 / 30 checks passed** · 6 routes × 5 viewports · candidate `cand_f508d4cb021b`

| Viewport | Routes passed |
| -------- | ------------- |
| 360×800  | 6/6           |
| 390×844  | 6/6           |
| 768×1024 | 6/6           |
| 1280×800 | 6/6           |
| 1440×900 | 6/6           |

Per combination: HTTP status, non-empty `<main>`, absence of any `role="alert"` error
surface, runtime console errors, `scrollWidth <= clientWidth`, and a screenshot.
Report: `evidence/ui/cand_f508d4cb021b/report.json`.

Tap targets are recorded, not blocking. The done-toggle — the most-tapped control in the app —
measured 20×20; it now carries a 44×44 hit area via an expanded `::before`, with the visible
circle still 20px so the row rhythm is unchanged. The elements still flagged are inline text
links inside prose, where a 44px target would wreck the line rhythm.

## Full-frontend sweep — every state, including the blocked ones

`pnpm verify:frontend:xvfb` — **195 / 195 checks** · candidate `cand_f508d4cb021b`
**39 surfaces × 5 viewports**, six seeded scenarios running in parallel.

Chromium runs **headed inside a virtual display pinned to `:99`**, so no window ever
reaches the user's Hyprland session — and the script refuses to run headed on `DISPLAY=:0`,
because an Xvfb that hunts for a free display can take over a live wlroots session through
the abstract socket. Headless is the default and needs no display at all; headed exists only
because it renders fonts and scrollbars the way a real browser does.

Per surface: render, runtime console errors, horizontal overflow, unexpected `role="alert"`
surfaces, **and a full axe-core scan**. Network failures are classified by origin, so a
third-party CDN having a bad minute is recorded (`externalErrors`) without blocking, while a
4xx from our own server or from Supabase blocks.

**a11y across the whole sweep: critical = 0 · serious = 0 · moderate = 0 · minor = 0.**

Surfaces the earlier `verify:ui` never reached, now covered:

| Group                           | Surfaces                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Unauthenticated                 | login (signup / signin / rejected credentials), 404, tester route                     |
| Onboarding                      | step 1, step 2, plan selected, "no encuentro mi carrera"                              |
| Today                           | empty · populated with overdue · unmapped plan · UNR                                  |
| Plan                            | UTN with correlativas · **UNR without them** · unmapped · final year · no progress    |
| Materias                        | each of the four filters · empty · unmapped                                           |
| Materia                         | blocked by correlativas · cursando · aprobada · UNR                                   |
| Calendario / Material / Ajustes | empty and populated, plus the note form                                               |
| Overlays                        | quick capture, quick capture with a validation error, search with and without results |

Six real defects were found on the first sweep and fixed — all of them on surfaces the
previous evidence had never rendered:

1. `--ink-faint` (#8a877f) is **3.29:1 on paper** and was used for real text on login,
   onboarding step numbers, the `kbd` and the tester route. The fix is not a colour tweak:
   this palette has **no room for a third text tier at AA**, because anything readable
   collapses into `--ink-muted`. The token is now documented as non-text (glyphs, chevrons,
   placeholders) and every text use moved to `--ink-muted`.
2. `opacity-70` on the count badge inside the active filter button composited white-on-accent
   to **3.84:1**. Now `opacity-90`.
3. `nested-interactive`: the search palette put a `<button>` inside `role="option"`. The
   option is now the row itself — correct for the combobox pattern, where focus stays on the
   input and `aria-activedescendant` carries the selection.
4. `scrollable-region-focusable` on the code blocks in the tester route.
5. `scripts/tester.mjs` had no CLI guard, so importing `SCENARIOS` from the sweep **re-seeded
   every account mid-run**, deleting and recreating the users whose sessions were in flight.
   That was the source of intermittent 404s.
6. The sweep's own console filter matched on message text, which Chromium does not populate
   with the URL — so a Google Fonts 404 was indistinguishable from an app bug.

## Honesty fix the sweep exposed

Rendering the UNR plan made a real product defect visible that no automated check would have
caught: with no correlativa graph, **not one materia showed as blocked and nothing said why**.
Silence there reads as "nada te bloquea", which is an academic claim Campus does not have the
data to make. Plan and the materia detail now state explicitly that the faculty has not
published the correlatividades — see `prerequisiteCount` in `useAcademicPlan`.

That is P-05 applied to the _absence_ of data, not just to its content.

## Accessibility evidence — CAP-A11Y-001

`pnpm verify:a11y` — axe-core via `@axe-core/playwright`, tags `wcag2a wcag2aa wcag21a wcag21aa`.

**critical = 0 · serious = 0 · moderate = 0 · minor = 0** across 12 scans
(6 routes × {390×844, 1280×800}) · candidate `cand_f508d4cb021b`.

Three real violations were found on the first run and fixed, not suppressed:
`--ink-muted` was 4.48:1 on paper (darkened to 5.11:1), the progress bar had no accessible
name, and prose links were distinguishable by colour alone.
Report: `evidence/a11y/cand_f508d4cb021b/report.json`.

## End-to-end journey — PRD §17 release definition

`pnpm verify:journey` — **20 / 20 steps** through the real UI, real Auth and real Postgres.

```text
crear cuenta → onboarding (UTN → FRRo → Ing. en Sistemas → Plan 2023) → Hoy
→ Plan (40 materias) → materia bloqueada nombra su correlativa faltante
→ marcar Cursando → agregar entrega → visible en la materia, en Hoy y en Calendario
→ sobrevive un reload completo
→ aprobar Análisis Matemático I → Análisis Matemático II SIGUE bloqueada por Álgebra
→ aprobar Álgebra → Análisis Matemático II pasa a Disponible (11 → 13 disponibles)
→ 0 errores de consola en todo el recorrido
```

The negative assertion is deliberate: satisfying one of two correlativas must **not**
unlock the dependant. Report: `evidence/journey/cand_f508d4cb021b/report.json`.

## Review

Four lenses (risk, resilience, readability, reliability) plus a refuter pass.

| Lens        | Outcome                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Risk        | No critical/severe/moderate. RLS complete; `security definer` search_path pinned; no service-role reachable from `src/` or the bundle. 2 minor findings — both fixed. |
| Resilience  | **1 critical**, 1 severe, 2 moderate, 2 minor — all fixed.                                                                                                            |
| Reliability | 0 critical. 5 moderate, 1 minor — all fixed.                                                                                                                          |
| Readability | **Not obtained** — see limitation below.                                                                                                                              |

Defects found and fixed in the bounded correction pass (commit `374ec55`):

1. _(critical)_ A failed academic-context fetch was indistinguishable from "no carrera", so a
   transient error redirected a returning student into onboarding — where re-running it would
   deactivate their real context.
2. _(severe)_ Course detail rendered a failed items/resources fetch as "no tenés nada
   anotado", inviting duplicate entries.
3. _(moderate)_ `unlocks` listed each dependant twice, because every real correlativa is
   seeded as both a `to_take` and a `to_pass` edge. Also claimed `to_pass`-only edges
   "unlock" subjects that were never blocked.
4. _(moderate)_ Three RLS isolation tests would have passed under a `USING (false)` policy.
5. _(moderate)_ The search-limit test exercised only the length guard and proved nothing.
6. _(moderate)_ `verify:ui` could report a pass on a screen rendering the app's own error banner.
7. _(moderate)_ Verify scripts leaked the preview server and the test user if setup failed
   part-way; toggle/delete failures were silent.
8. _(minor)_ Unpaginated user lookup in cleanup; inconsistent `evidence/` ignore rules;
   onboarding painted for one tick when signed out.

Then the **refuter** attacked the correction pass itself and overturned two of its seven claims:

9. _(refuted → fixed)_ The critical fix guarded only the automatic redirect. `/today` — the
   default landing screen — still rendered "Todavía no elegiste tu carrera" with a link into
   onboarding when the context fetch errored: the same defect, reached by a click instead of a
   redirect. `today.tsx` now checks `plan.error` before that branch.
10. _(refuted → fixed)_ `seedStudent` creates the auth user and can throw before returning the
    object that carries `cleanup`, so the null-guarded `finally` in the calling script never
    fires and the user is orphaned. It now undoes its own partial work.

Upheld by the refuter: the `unlocks` deduplication, the course-detail error branches, the three
strengthened RLS tests, the `role="alert"` gate in `verify:ui` — including that it cannot cause
false failures, since no mutation runs during the sweep — and the search-limit test.

## Authorization — REFUSED

```text
node $H authorize pre-commit --json
→ { "gate": "pre-commit", "authorized": false, "reasons": ["no receipt"] }
```

**Missing evidence: a protocol-bound review receipt.**

Honest account of why:

- The review ran, and it found real defects that were really fixed. But the shipped lens
  subagents (`review-risk`, `review-resilience`, `review-readability`, `review-reliability`)
  are provisioned with `Read`/`Grep`/`Glob`/`codegraph` only. They have no shell, so they
  cannot invoke `gentle-ai review inspect-candidate`, which is the only sanctioned way to
  read the frozen candidate tree.
- `review-readability` correctly **refused** to review rather than substitute the live
  worktree for the frozen tree, and returned an empty result with that as its evidence. The
  other three proceeded against the live worktree and each said so explicitly.
- The correction pass then rewrote the tree the lineage was bound to. `gentle-ai review
invalidate` refuses to transition it, reporting exactly that drift:
  `expected sha256:54cd0c6e…, got sha256:554cab97…`. Lineage `review-54cd0c6edf4195e3`
  is left `active`/`reviewing` against a superseded snapshot.
- Producing a receipt from here would mean authoring reviewer result JSON myself and feeding
  it to `gentle-ai review capture-result`. That would make the reviewed artifact something I
  wrote, which is precisely what the write-isolation invariant forbids. **Not done.**

**What this means:** the deterministic, database, responsive, accessibility and end-to-end
evidence above is real and reproducible. The delivery authorization is not granted, and this
change is **not** cleared for delivery under the receipt-driven policy.

To close it, run the four lenses in an environment where the lens agents can execute
`gentle-ai review inspect-candidate` against lineage-bound trees, on a freshly started
lineage over commit `374ec55`.

## Reproducing this

```bash
pnpm install && pnpm db:start && pnpm db:reset
# write .env from `supabase status` — see README
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:db && pnpm build
pnpm build && pnpm verify:journey && pnpm verify:ui && pnpm verify:a11y
```
