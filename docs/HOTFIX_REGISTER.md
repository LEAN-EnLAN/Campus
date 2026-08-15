# Hotfix register

Unresolved **P0 / P1** findings only. Ordinary TODOs do not belong here.

Last updated: 2026-08-15, COMODÍN hotfix pass.

## Resolved in this pass

| id        | finding                                             | proof                                                                                                                                                                                                                                                                                                                              |
| --------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0-01** | `prerequisitesKnown` had no executed cloud coverage | RESOLVED — `pnpm db:reset` applies `20260815000100`; Postgres holds UTN `t`/186 edges and UNR `f`/0 edges with its note. `test:db` 29/29 asserts the adapter reads the column. Zero `prerequisites.length > 0` inferences remain in production code (the three matches are comments forbidding it)                                 |
| **P0-02** | A-10 dual-adapter conformance did not exist         | RESOLVED — `tests/db/conformance.test.ts`, all 16 methods against both adapters. Caught a real divergence on its first run (below). Mutation-verified: restoring `known = edges.length > 0` in both adapters kills exactly the known-empty fixture                                                                                 |
| **P1-03** | 3 unresolved browser checks / intermittent 404s     | RESOLVED — diagnosed, not dismissed. Two were the check racing the destination; the last was a defect in the TEST (phase boundary sat after the rename, so the missing-vault phase's own correct 404 was attributed to the happy path). `scripts/lib/dev-server.mjs` replaces unbounded readiness loops. `pnpm verify:local` 12/12 |
| **P1-04** | A-11 never ran                                      | RESOLVED — `pnpm verify:a11` 8/8 with Supabase at `http://127.0.0.1:1`, across a real restart of both browser and server                                                                                                                                                                                                           |
| **P1-05** | Vault API bind could follow `vite --host`           | RESOLVED — `src/server/bind-guard.ts` fails startup loudly. 24 classifier tests, `pnpm verify:bind` 10/10: `vite --host` exits 1; `CAMPUS_VAULT_API=off` serves the frontend with no token injected and the endpoint unmounted                                                                                                     |

### Divergence A-10 caught, and fixed

`SupabaseBackend.curriculumBundle` **threw** for a curriculum that does not
exist (`.single()`), while `LocalBackend` answered `prerequisitesKnown: false`.
The same question got an error from one adapter and an answer from the other.
Fixed with `maybeSingle` and the identical UNKNOWN bundle.

---

## Open

### P1-06 — the A-11 journey stops at academic context

**Threatens:** the completeness of the Milestone A claim.

`verify:a11` proves: open vault → onboarding → Today → `context.json` written →
restart → same vault, same state, no Supabase.

It does **not** yet cover the second half of the specified journey: marking a
subject `in_progress`, creating a deadline, seeing it in Today and in the
Course, and finding all three after a restart. `subject-state.json` and
`items.json` are covered by the conformance suite against a new instance, but
not through the UI.

**Exit:** extend `verify:a11` through Plan and the deadline form, then assert
the three files after the restart boundary.

### P1-07 — UNR uncertainty is not verified through the UI

**Threatens:** canonical academic semantics at the surface the student sees.

Every layer below the UI is proven: research provenance → catalog → seed →
Postgres → both adapters, all asserting UNKNOWN with its note. The rendering
is not covered by a browser check, so nothing prevents a screen from showing an
empty prerequisite list as "nothing blocks you".

**Exit:** a bounded local journey selecting UNR FCEIA LCC TO 2024 that asserts
the explanatory copy appears and no course renders as unblocked.

### P1-08 — frontend and a11y sweeps not run against the new surfaces

**Threatens:** regression coverage.

Startup composition changed materially (`RuntimeProvider` now wraps the router)
and three surfaces are new: the picker, the missing-vault explanation, and the
cloud choice. `verify:frontend` and `verify:a11` were **not** executed in this
pass, so the 195-check sweep and the zero-violation a11y counts are unverified
against the current tree.

**Exit:** run both, extend the surface list, keep critical = 0 and serious = 0.
