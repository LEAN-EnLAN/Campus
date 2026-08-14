# campus-poc-foundation — Proposal

**Status:** implemented and verified
**Date:** 2026-08-14
**Source of truth:** `docs/PRD.md`, `docs/design.md`

## Intent

Build the first real vertical slice of Campus: a personal academic operating system for
Argentine university students. Not a mockup — a running application with a real database,
real academic data from official sources, real Row Level Security, and evidence that a
student can complete the core loop end to end.

## Problem

An Argentine student's academic life is scattered across WhatsApp, PDFs, Drive, a calendar,
notes, autogestión, and screenshots. Nothing in that pile understands that a _materia_ has
_correlativas_, that a _plan de estudios_ has versions, or that "what do I have to do today"
is a different question from "what am I allowed to enrol in".

Campus POC does not try to merge all of that. It solves one problem:

> Turn the student's own cursada into something clear, trustworthy and pleasant to consult
> every day.

## Scope

**In:** academic onboarding (institution → unit → program → curriculum), Today, Plan by
year with derived availability, subject detail, academic items (deadlines/exams), calendar
week view, resources as links and notes, search, responsive shell, accessibility.

**Out (recorded, not built):** everything in `docs/future-ideas.md` and PRD §16 non-goals.

## Approach

1. **A pure domain layer.** Availability, progress, agenda bucketing and search live in
   `src/domain/**` with no React and no Supabase. This is where correctness is proven, by
   unit tests with no mocks.
2. **Supabase as the whole backend.** Postgres + Auth + RLS. No separate Node service.
   Schema changes only through committed migrations.
3. **Two data tiers.** Curated academic reference data (read-only from the client) and
   user-owned data (RLS-isolated per user, proven by an A/B test with real JWTs).
4. **Academic data from official documents only.** Researched, recorded with provenance,
   converted mechanically into seed SQL. Never typed by hand, never guessed.
5. **Evidence over narration.** A candidate hash binds unit tests, DB/RLS tests, a
   viewport matrix, an axe-core scan and a full end-to-end journey to one exact state of
   the code.

## Key decisions

| Decision                                                                        | Why                                                                                                                          |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `available`/`blocked`/`pending` are **derived**, never stored                   | Storing them lets the database drift out of sync with the prerequisite graph                                                 |
| A stored status wins over a derived one, conflicts are surfaced not overwritten | The student knows their own cursada better than our seed does                                                                |
| A `to_pass` gap does not block a cursada                                        | Correlativas "para rendir" only matter at final time; blocking on them would hide subjects the student can legitimately take |
| `curriculum_subjects` is unique on `(curriculum_id, subject_id, display_order)` | UNR FCEIA's plan genuinely lists two separate "Horas electivas" blocks — the naive constraint silently dropped one           |
| Explicit `grant` migration                                                      | RLS decides _which rows_; it does not grant the table privilege. Without grants PostgREST answers "permission denied"        |
| Playwright + axe-core for `verify:ui` / `verify:a11y`                           | These must be real commands with real exit codes runnable in CI. The interactive browser MCP tooling cannot provide that     |

## Success condition

```text
sign up → onboarding → curriculum → course state → deadline → Today
       → course detail → academic progress
```

against real persisted data, with green deterministic checks, responsive evidence,
accessibility evidence and a valid receipt.
