# Mission

Build the first real proof-of-concept of **Campus**, an academic operating system for Argentine university students.

This is not a throwaway mockup. It is a small, high-quality vertical slice intended to be used by real students and to exercise the developer harness against a real frontend, backend, database, responsive UI, and accessibility surface.

Authoritative product documents:

```text
docs/PRD.md
docs/design.md
```

Do not replace them with your own product vision.

# Compact table of contents

```text
0  Bootstrap + infra gate
1  Create project-specific Skills           LINEAR
2  Establish repo/tooling                   LINEAR
3  SDD / requirement extraction             LINEAR
4  Parallel Track A — data/backend
5  Parallel Track B — design/frontend
6  Parallel Track C — verification
7  Integration
8  Real academic seed
9  End-to-end UX
10 Browser responsive verification
11 Accessibility
12 Candidate / RDD / receipt
13 Final report
```

# 0. Bootstrap

Create a new real Git repository for the project under the normal registered projects root, named `campus-poc`.

Before meaningful work:
- run `claude-dev-infra` fast doctor;
- resolve authoritative project identity;
- create repo;
- `git init`;
- make initial base commit when appropriate;
- register project with devinfra;
- configure Engram project identity;
- ensure CodeGraph can index it.

Never mutate `$HOME/.git`.

If infra reports an issue, route it through the existing infra mechanism and continue after health is restored.

# 1. FIRST IMPLEMENTATION TASK — Project-specific Skills

This phase is strictly linear. Do not start product implementation before it completes.

Create project-local Skills:

```text
campus-product
campus-design-system
campus-frontend
campus-supabase
campus-quality
campus-academic-data
```

## campus-product
PRD index, core loop, POC scope, non-goals, requirement IDs, Argentine academic terminology.

## campus-design-system
Editorial/notebook doctrine, tokens, typography, responsive rules, component reuse, empty-state tone, visual references. Warn against generic SaaS, gradient-heavy UI, glassmorphism and stock shadcn.

## campus-frontend
Rules for React, TypeScript, Vite, TanStack Router/Query, shadcn/ui and Tailwind. Composition first; project components first; shadcn search second; domain logic outside UI.

## campus-supabase
Local Supabase, migrations only, generated DB types, Auth, RLS, seed conventions, test DB policy, never expose service-role.

## campus-quality
developer-harness integration, quality tiers, browser matrix, a11y policy, candidate/receipt requirements, claimed ≠ verified.

## campus-academic-data
Provenance hierarchy, institution/unit/program/curriculum concepts, no invented data, official-source-first, plan versioning.

Verify all six skills are discoverable. Record evidence. Only then continue.

# 2. Establish stack

Use:
- React
- TypeScript strict
- Vite
- TanStack Router
- TanStack Query
- Tailwind
- shadcn/ui
- Supabase/Postgres/Auth
- Docker local backend

Prefer pnpm unless evidence says otherwise.

Do not introduce Next.js or a separate Node backend without a concrete need.

# 3. Run SDD

Use Gentle-AI SDD. Create change `campus-poc-foundation`.

Consume `docs/PRD.md` and produce durable:
- proposal
- spec
- design delta if necessary
- tasks

Preserve PRD requirement IDs. Every task declares which requirement(s) it implements.

# 4. Establish quality commands before feature development

Provide real commands equivalent to:
- format
- format:check
- lint
- typecheck
- test
- test:full
- build

No fake scripts. Harness quality profile must resolve correctly.

# 5. Parallelization boundary

ONLY AFTER repo created, infra healthy, skills live, stack initialized, quality commands real and SDD tasks exist, begin parallel work.

Use top-level fan-out only. No uncontrolled recursive delegation.

# 6. Parallel Track A — Data/backend/infra

Own primarily:
`supabase/**`, `src/domain/**`, `src/lib/db/**`, `tests/domain/**`

Goals:
- local Supabase
- schema for institutions, academic_units, programs, curricula, subjects, curriculum_subjects, prerequisites, profiles, user_academic_contexts, user_subject_states, academic_items, resources
- RLS with A/B isolation tests
- domain services for subject transitions, prerequisites, available subjects, progress, Today/Upcoming
- minimal auth
- resources start as links/text; uploads only if ownership/limits/type checks are proven

# 7. Parallel Track B — Research/design/frontend

Own:
`src/routes/**`, `src/components/**`, `src/styles/**`, `src/features/**`, `docs/research/**`, `registry/**`

First, do a short visual research pass and inspect:
- https://www.craft.do/
- https://craft-support.mintlify.app/en/plan-and-do/calendar
- https://www.craft.do/blog/introducing-tasks
- https://outliner.tana.inc/daily-notes
- https://tana.inc/
- https://culturedcode.com/things/features/
- https://anytype.io/
- https://supernotes.app/
- https://mobbin.com/explore/web/screens/goal-task
- https://mobbin.com/explore/mobile/flows/onboarding
- https://pageflows.com/

Create `docs/research/visual-reference-notes.md` with what to borrow, what not to borrow, specific insight and relevance to Campus.

Then establish tokens, typography, spacing, borders, radii, motion and focus styles.

For every reusable primitive:
`search local → search shadcn registry → inspect → reuse/compose → create only if needed`

Build:
- /onboarding
- /today
- /plan
- /calendar
- /courses
- /courses/:courseId
- /library
- /settings

Implement loading, empty, populated and relevant error states.

Mobile first: 360–390px before tablet and desktop.

# 8. Parallel Track C — Verification enablement

Own:
`tests/**`, `.harness*`, browser/a11y helpers

Implement real `verify-ui` using:
`t3-code preview → local app`, `camofox → fallback`, `agent-capture → durable evidence`

Viewport matrix:
- 360×800
- 390×844
- 768×1024
- 1280×800
- 1440×900

Capture render status, runtime errors, horizontal overflow, screenshots and critical interactions.

Wire a real accessibility engine. Block on critical>0 or serious>0.

Ensure UI/a11y evidence is candidate-bound and invalidates on drift.

# 9. Real academic data research

Official sources only.

Start from:
- https://utn.edu.ar/
- https://www.frro.utn.edu.ar/
- https://unr.edu.ar/carreras-de-grado/
- https://unr.edu.ar/ciencias-exactas-ingenieria-y-agrimensura/

Preferred first complete path:
UTN → Facultad Regional Rosario → Ingeniería en Sistemas de Información → current documented curriculum.

Add a second institution/unit/program path sufficient to prove the model is not UTN-specific.

If official plan is PDF:
- inspect actual PDF;
- capture source URL;
- record retrieval date;
- do not hallucinate unreadable cells;
- do not merge plan versions silently.

# 10. Integrate the vertical slice

First complete user journey:

```text
sign up
→ onboarding
→ choose university/unit/program/curriculum
→ Today
→ Plan
→ mark a subject in progress
→ add deadline
→ deadline appears in Today
→ open subject
→ deadline visible there
→ mark subject passed
→ dependent availability recalculates
```

Use real persisted data. No local React state pretending persistence.

# 11. Copy

UI language: Spanish (Argentina).

Tone: clear, warm, short, not infantilizing, not corporate, no forced slang.

Good:
- ¿Qué tenés para hoy?
- Próximamente
- Tu plan
- Agregar entrega
- No tenés nada para hoy.

Avoid productivity/AI hype.

# 12. Integration convergence

When parallel tracks have real artifacts:
1. stop new feature work;
2. integrate backend/UI;
3. deterministic checks;
4. fix contract mismatches;
5. run core journey;
6. multi-viewport verification;
7. accessibility;
8. then polish.

# 13. Design polish pass

After core behavior passes, run a dedicated design reviewer using:
- campus-design-system
- impeccable
- web-design-guidelines
- audit
- relevant React skills

Review hierarchy, density, typography, spacing, responsive composition, empty/loading states, focus, motion, generic-shadcn leakage and generic-AI aesthetic.

Apply one bounded correction pass.

# 14. Deterministic completion checks

Required classes:
- format
- lint
- typecheck
- unit tests
- integration/database tests
- build
- UI verification
- a11y

All must execute. Missing evidence ≠ passed.

# 15. RDD

When deterministic evidence is green:

```text
freeze candidate
→ Gentle-AI default 4R review
→ refuter
→ bounded correction if severe
→ rerun invalidated evidence
→ freeze final candidate
→ produce receipt
```

Do not invoke Judgment Day or ultrareview automatically.

# 16. Required receipt properties

Receipt references:
- candidate identity
- PRD requirements
- SDD task IDs
- format
- lint
- typecheck
- tests
- DB/RLS
- build
- UI viewport evidence
- a11y
- review
- authorization

No log blobs inside model context.

# 17. Scope guard

If ideas emerge for chat, community, reviews, AI, marketplace, automatic enrollment, billing or advanced admin, record them in `docs/future-ideas.md`. Do not implement.

# 18. Source-of-truth order

Product:
`PRD → design.md → SDD design/spec → project Skills → existing convention → agent preference`

Academic facts:
`official university source → official faculty/regional source → curated Campus data → user data`

Never let an LLM guess academic facts.

# 19. Stop conditions

Do not fake completion when:
- Supabase cannot run
- RLS cannot be tested
- browser cannot render app
- a11y engine unavailable
- academic source cannot be verified
- candidate cannot be identified
- receipt cannot validate

Continue independent safe work.

# 20. Final output contract

Return:
- Mission status
- Repository path/branch/commit/tree
- Skills created + discoverability evidence
- SDD active change + requirements/tasks/verification
- Product implemented
- Academic seed + official source URLs
- Backend evidence
- Frontend evidence
- UI verification per viewport
- Accessibility counts
- Deterministic checks exact commands + exit states
- Receipt summary
- Remaining POC gaps
- How to run

# Final success condition

The POC succeeds only if this real persisted workflow works:

```text
student
→ onboarding
→ curriculum
→ course state
→ deadline
→ Today
→ course detail
→ academic progress
```

and the exact candidate has deterministic evidence, responsive runtime evidence, accessibility evidence, independent review, valid receipt, and correct authorization state.
