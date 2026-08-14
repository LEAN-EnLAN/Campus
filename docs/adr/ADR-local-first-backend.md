# ADR — the local-first backend boundary

**Status:** accepted
**Date:** 2026-08-14
**Baseline:** commit `37bf9d4`, candidate `cand_c8239816f161d0be557ed856`, all checks green
**Supersedes:** nothing. The POC architecture stands; this adds a seam.

## Context

Campus works. 48 unit tests, 15 RLS isolation tests, a 20-step end-to-end journey and 195
route×viewport checks with zero accessibility violations. None of that is in question.

The problem is one line of coupling, repeated sixteen times:

```ts
// src/features/academic/queries.ts, src/features/items/queries.ts
const { data, error } = await supabase.from('academic_items').select(...)
```

Five files import the Supabase client today:

```text
src/features/academic/queries.ts     the academic hooks
src/features/items/queries.ts        items and resources
src/features/auth/auth-context.tsx   session
src/lib/supabase.ts                  the client itself
src/routes/dev.tsx                   tester tooling (reads the resolved URL for diagnostics)
```

Every one of the sixteen data hooks reaches Postgres directly. That makes Supabase not a
backend but _the_ backend — and the product we are building must be complete with Supabase
stopped, no account, and no network.

The existing layering is otherwise good and is **not** what needs changing:

```text
src/domain/**      pure logic, no React, no I/O          ← already correct, untouched
src/lib/db/**      Supabase row ↔ domain mapping         ← already the right idea
src/features/**    query orchestration                   ← this is where the leak is
src/components/**  presentation
src/routes/**      thin composition
```

## Decision

Introduce **one** seam, `CampusBackend`, between the TanStack Query hooks and whatever
actually stores the data.

```text
components
    ↓
TanStack Query hooks          ← unchanged: still the caching and invalidation layer
    ↓
CampusBackend                 ← the seam
   ┌────┴──────────┐
LocalBackend   SupabaseBackend
 (a folder)     (Postgres + RLS)
```

### The interface is exactly the use cases that already exist

Sixteen hooks, sixteen methods. It was derived by listing the current hooks, not by
imagining a data model.

```ts
export interface CampusBackend {
  /** Curated academic reference data. Read-only in every mode. */
  catalog: {
    institutions(): Promise<Institution[]>
    academicUnits(institutionId: string): Promise<AcademicUnit[]>
    programs(academicUnitId: string): Promise<Program[]>
    curricula(programId: string): Promise<Curriculum[]>
    curriculumBundle(curriculumId: string): Promise<CurriculumBundle>
  }

  /** The student's own academic state. */
  academic: {
    context(): Promise<AcademicContext | null>
    saveContext(input: SaveContextInput): Promise<AcademicContext>
    subjectStates(): Promise<UserSubjectState[]>
    setSubjectStatus(input: SetSubjectStatusInput): Promise<void>
  }

  items: {
    list(): Promise<AcademicItem[]>
    create(input: CreateItemInput): Promise<AcademicItem>
    setDone(id: string, done: boolean): Promise<void>
    remove(id: string): Promise<void>
  }

  resources: {
    list(): Promise<Resource[]>
    create(input: CreateResourceInput): Promise<Resource>
    remove(id: string): Promise<void>
  }
}
```

`notes`, `files` and `search` join later, when the vault work gives them callers. **A method
with no caller does not get written.**

### What deliberately does not change

- **TanStack Query stays.** It is the cache, not the transport. Hooks keep their keys, their
  `staleTime`, their invalidation. The only edit inside a hook is what it awaits.
- **`src/domain/**` stays pure.** `computeSubjectViews`, `buildAgenda`, `computeProgress` and
  `search` take plain data and return plain data. They never learn where the data came from.
  The academic authority remains TypeScript.
- **`src/lib/db/**` stays the Supabase mapper.** It stops being shared vocabulary and becomes
  an implementation detail of `SupabaseBackend`.
- **RLS, migrations and `test:db` stay exactly as they are.** The cloud path is a
  compatibility guarantee.

### Runtime and session

`_app.tsx` currently gates the whole product on Supabase Auth. That stops being globally true.

```ts
type CampusRuntime =
  | { mode: 'local'; vault: VaultDescriptor; profile: LocalProfile }
  | { mode: 'cloud'; session: CloudSession }
```

The runtime selects the backend once, at the provider. **LOCAL mode never fabricates a
Supabase user.** `/login` is not deleted — cloud remains a first-class mode.

## Alternatives considered

**Keep Supabase and add a local sync layer underneath it.** Rejected: it keeps Postgres as
the shape of truth, so the file format would be an export rather than the canonical store.
That inverts the product thesis.

**A generic repository layer (`Repository<T>`, `find(criteria)`).** Rejected: it would grow an
abstract query language nobody asked for, and every backend would have to implement filters
no screen uses. Sixteen named methods are easier to read and impossible to misuse.

**Branch inside each hook (`if (mode === 'local')`).** Rejected: sixteen branch points that
must all be updated together, and the runtime leaks into feature code. One seam or none.

**Port the academic engine to Rust for a shared core.** Rejected for now. `src/domain/**` is
pure, fast, and covered by 48 tests; rewriting it buys nothing and risks the one part of the
system that is provably correct. Rust, if it arrives, owns local _infrastructure_ — vault,
watcher, index, search — not the academic model.

## Consequences

Good:

- LOCAL mode becomes expressible without touching a component
- the Supabase surface becomes auditable: one directory, one import
- adapters are testable in isolation; a backend conformance suite can run against both
- `src/domain/**` is now reachable from a shell that has no browser and no Postgres

Costs, stated honestly:

- one more indirection between a screen and its data
- two implementations to keep behaviourally equivalent, which needs a shared test suite or
  they will drift
- IDs are UUIDs from Postgres today; the local backend must mint its own stable IDs, and the
  formats must not be assumed interchangeable

Accepted risk:

- **behavioural drift between adapters.** Mitigation: a single conformance suite run against
  both, and the existing journey re-run in both modes before either is called done.

## Invariants this ADR is accountable for

1. no component or hook imports `@supabase/supabase-js`
2. `src/domain/**` remains pure and backend-agnostic
3. LOCAL mode works with the Supabase stack stopped and the network unplugged
4. the CLOUD journey and `pnpm test:db` do not regress
5. **unknown prerequisite data ≠ no prerequisite**, in every backend — UNR FCEIA has no
   published correlatividades and that must stay _unknown_ in LOCAL mode, never an empty list
   that reads as "nothing blocks you"

Invariant 5 is not a data detail. It is the reason a student can trust the plan screen.
