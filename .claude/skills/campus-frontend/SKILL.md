---
name: campus-frontend
description: Campus frontend engineering rules — React 19, TypeScript strict, Vite, TanStack Router, TanStack Query, Tailwind v4, shadcn/ui. Composition first, project components first, domain logic outside the UI. Use when writing or reviewing any file under src/ — routes, components, features, hooks or data fetching.
---

# Campus — frontend rules

## Stack (fixed — do not swap without a concrete, stated need)

React 19 · TypeScript strict · Vite · TanStack Router (file-based) · TanStack Query ·
Tailwind CSS v4 · shadcn/ui · Lucide · Supabase JS client · Vitest + Testing Library.

**No Next.js. No separate Node backend.** Supabase is the backend.

## Directory contract

```text
src/
├── app/          providers, router bootstrap, query client
├── routes/       TanStack Router route files — thin, composition only
├── components/   reusable presentational primitives (no data fetching)
│   └── ui/       shadcn primitives, re-skinned to Campus tokens
├── features/     feature slices: hooks + feature-specific components
├── domain/       PURE business logic. No React, no Supabase, no I/O.
├── lib/          adapters — supabase client, db types, query keys, utils
└── styles/       tokens.css, globals.css
```

**`src/domain/**` must be importable in a plain Node test with zero mocks.** If a domain
file imports React or Supabase, it is in the wrong folder.

## The hard rule: domain logic lives outside the UI

CAP-PLAN-002 requires that marking a subject `passed` recalculates dependants' availability
**in the domain layer**. Concretely:

```ts
// ✅ src/domain/availability.ts — pure, unit-testable
export function computeAvailability(
  subjects: CurriculumSubjectView[],
  states: Map<string, SubjectStatus>,
  prerequisites: PrerequisiteEdge[],
): Map<string, SubjectStatus>

// ❌ never: useMemo inside PlanScreen that re-derives availability from component state
```

Components read derived data. They do not derive it.

## Component authoring order — mandatory

```text
1. search src/components  →  reuse
2. shadcn registry        →  read the `shadcn` skill, add, then RE-SKIN to Campus tokens
3. configured registry
4. author new             →  only when 1–3 come back empty
```

Run `node ~/Documents/GitHub/developer-harness/src/cli/index.mjs component "<intent>" --json`
first. Adding a stock shadcn component and shipping it unstyled is a review-blocking defect
(see `campus-design-system`).

## Composition over configuration

Boolean prop proliferation is the smell. Prefer compound components and slots.

```tsx
// ❌ <SubjectRow showStatus showProgress compact isBlocked withActions />
// ✅ <SubjectRow><SubjectRow.Status/><SubjectRow.Title/><SubjectRow.Meta/></SubjectRow>
```

Container / presentational split: `features/*/hooks` fetch and derive; `components/*` render.
A component in `src/components` never calls `useQuery`.

## TanStack Query

- All keys come from `src/lib/query-keys.ts`. Never inline a key array in a component.
- Every list/detail screen handles **four** states explicitly: `loading`, `empty`,
  `populated`, `error`. An unhandled empty state is a defect, not a nicety.
- Mutations invalidate through the key factory, not by refetching manually.
- `staleTime` defaults to 30s; academic reference data (institutions, curricula) uses
  `staleTime: Infinity` — it does not change during a session.

## TanStack Router

File-based routes under `src/routes`. Routes are **thin**: they compose a feature component
and nothing else. No data transformation in a route file. Auth-gating happens in
`beforeLoad` on the protected layout route, not in each screen.

## TypeScript

`strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`.

- **`any` is banned.** Use `unknown` + a narrowing function.
- Database types are **generated** into `src/lib/db/database.types.ts`. Never hand-edit them.
- Domain types are hand-written in `src/domain/types.ts` and are _not_ the DB row types —
  map at the `lib/db` boundary so the UI never depends on column names.
- Prefer discriminated unions over optional-field soup.

## Tailwind v4

- Tokens via `@theme` in `src/styles/tokens.css`. Use semantic classes (`bg-paper`,
  `text-ink-muted`, `border-rule`) — **never** `bg-[#f7f5ef]` and never default palette
  classes like `bg-zinc-50`.
- Class order: layout → box → typography → colour → state. Use `cn()` from `src/lib/utils.ts`.
- No arbitrary values except for genuinely one-off geometry.

## Accessibility (non-negotiable — CAP-A11Y-001)

- Semantic HTML first: `<nav>`, `<main>`, `<section>` with `aria-labelledby`, real `<button>`.
- Every interactive element has an accessible name. Icon-only buttons get `aria-label`.
- Forms: `<label htmlFor>` always; errors linked with `aria-describedby` and
  `aria-invalid`; error text is not colour-only.
- Focus is visible everywhere. Dialogs/sheets trap focus and restore it on close.
- Live regions for async feedback (`aria-live="polite"` on toast/status).
- Respect `prefers-reduced-motion`.

## Testing

- `src/domain/**` → pure unit tests, high coverage, no mocks. This is where correctness lives.
- `src/features/**` → Testing Library, query by **role and accessible name**, never by test-id
  as a first choice.
- No snapshot tests of whole screens.

## Performance

Route-level code splitting via router lazy routes. Do not `useMemo`/`useCallback`
prophylactically — React 19 + the compiler handle most of it; add memoisation only with a
measured reason. Lists are short (a curriculum is ~40 subjects) — no virtualisation needed.

## Forbidden

`any` · inline hex colours · `dangerouslySetInnerHTML` · direct `fetch` to Supabase REST
(use the client) · business logic in `.tsx` · `useEffect` for data fetching (that's Query's job) ·
localStorage as the source of truth for academic data · `console.log` in committed code.

## The backend boundary

Hooks no longer talk to Supabase. They talk to `CampusBackend`.

```text
components → TanStack Query hooks → CampusBackend → { LocalBackend | SupabaseBackend }
```

- **No component or hook imports `@supabase/supabase-js`.** Only `src/lib/backends/supabase/**` does.
- No `if (mode === 'local')` in a component. If a screen has to branch on the runtime, the
  boundary is in the wrong place.
- `src/lib/db/**` stays the Supabase row↔domain mapper and becomes an implementation detail
  of the Supabase adapter.
- `src/domain/**` stays pure and backend-agnostic. Unchanged.

Keep the interface **small** — one method per use case that already exists. No generic
repository ceremony. Details in `campus-local-first`.
