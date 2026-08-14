# campus-local-first-workspace — Proposal

**Status:** in progress
**Date:** 2026-08-14
**Baseline:** `37bf9d4` · candidate `cand_c8239816f161d0be557ed856` · every check green
**Relationship to `campus-poc-foundation`:** additive. That change is **not** archived and its
`CAP-*` requirements remain binding. This is a product delta on top of a working POC.

## Intent

Evolve Campus from _an academic planner backed primarily by Supabase_ into

> **a local-first academic workspace where a student's real folder, Markdown notes, files,
> coursework, academic structure and executable code understand each other.**

## Why now

The POC proved the academic model: real curricula from official documents, a prerequisite
graph that recalculates in a pure domain layer, RLS-isolated persistence, and evidence for
all of it. What it cannot do is survive Campus.

Today a student's academic life lives in Postgres rows. If Campus disappears, so does the
work. The product that is actually worth building inverts that: **the student's folder is the
truth, and Campus makes it intelligent.**

## The promise this change is accountable for

> A student who stops using Campus still owns normal folders, Markdown, attachments and
> portable JSON — all readable without Campus.

Concretely: `.md` files a text editor opens, `.campus/*.json` a human can read, attachments
where the student put them, and a derived index that can be deleted without losing anything
but time.

## Not an Obsidian skin

The distinctive claim is not "notes with tags". It is that the academic model, the knowledge
graph, the filesystem and the student's workflows are **one coherent system**:

- a note declares `subject: arquitectura` in frontmatter and appears in that Course
- a Course is a semantic view over real files, not a row that owns hidden children
- a deadline created anywhere shows in Today, and lives in a JSON file the student can read
- a Python block in a lecture note runs — explicitly, never automatically

## Scope

Twelve epics: `LOCAL VAULT WORKSPACE EDITOR KNOWLEDGE CODE ACADEMIC DESKTOP SERVER DESIGN
SETTINGS QUALITY`. Requirements and scenarios in `spec.md`; tasks in `tasks.md`, each
declaring `implements:`.

Delivered in milestones, integrating at each boundary rather than building everything first:

| Milestone | Spine                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------- |
| **A**     | backend abstraction · local runtime · vault create/open · local academic catalog · local items            |
| **B**     | workspace shell · file explorer · Markdown editor · wiki links · backlinks · properties · command palette |
| **C**     | code block UI · Python and JS runners · output · timeout · security baseline                              |
| **D**     | Linux local server and desktop artefact · Windows build configuration                                     |

## Explicitly out of scope

cloud sync · real-time collaboration · plugin marketplace · AI tutor · billing · mobile-native
app · OCR · Git UI · a full Jupyter replacement · public sharing.

Architecture may leave clean extension points. Implementation waits. `LOCAL_PLUS_CLOUD`
conflict semantics are **documented, not built** — and never as an implicit last-write-wins.

## Key decisions

| Decision                                                                                 | Why                                                                                                                  |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| One seam, `CampusBackend`, with sixteen methods derived from the sixteen existing hooks  | A generic repository layer would grow a query language nobody asked for. See `docs/adr/ADR-local-first-backend.md`   |
| Supabase becomes one adapter, not the truth                                              | LOCAL mode must be complete with the stack stopped                                                                   |
| `src/domain/**` stays TypeScript and stays pure                                          | It is the provably correct part of the system. Rust, if it comes, owns local infrastructure — not the academic model |
| Markdown is the only document model                                                      | A parallel block store is what separates a local-first editor from a note app that exports Markdown                  |
| The portable academic catalog is **generated** from the same verified JSON as `seed.sql` | Two hand-maintained catalogs diverge, and a divergence means one is lying about a real curriculum                    |
| Execution is never automatic                                                             | Opening a note must never run code that arrived from a classmate                                                     |

## What must not regress

The POC journey, `test:db`, RLS A/B isolation, the 195-check frontend sweep at zero
accessibility violations, mobile navigation, the Xvfb `:99` protection, and the tester
scenarios.

And the epistemic invariant, which is the reason the plan screen is trustworthy:

```text
unknown prerequisite data  ≠  no prerequisite
```

UNR FCEIA publishes no correlatividades. In LOCAL mode that must still read as _unknown_,
never as an empty list that says "nothing blocks you".
