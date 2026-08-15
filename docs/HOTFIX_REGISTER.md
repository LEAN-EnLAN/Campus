# Hotfix register

Unresolved **P0 / P1** findings only. Ordinary TODOs do not belong here.

Last updated: 2026-08-15, COMODÍN continuation.

## All P0/P1 resolved

| id | state | proof |
|----|-------|-------|
| **P0-01** `prerequisitesKnown` unverified in cloud | **RESOLVED** | Postgres holds UTN `t`/186 edges, UNR `f`/0 edges + note. `test:db` 29/29. Zero `prerequisites.length > 0` inferences in production (the 3 matches are comments forbidding it) |
| **P0-02** no dual-adapter conformance | **RESOLVED** | `tests/db/conformance.test.ts`, 16 methods × 2 adapters. Caught a real divergence its first run: `SupabaseBackend` threw for a missing curriculum while `LocalBackend` answered UNKNOWN. Mutation-verified |
| **P1-03** unexplained browser failures | **RESOLVED** | Diagnosed. `scripts/lib/dev-server.mjs` bounds readiness and kills by pid. `verify:local` 12/12 |
| **P1-04** A-11 never ran | **RESOLVED** | `verify:a11` 16/16 |
| **P1-05** Vault API could follow `--host` | **RESOLVED** | `bind-guard.ts` fails startup loudly. 24 unit + `verify:bind` 10/10 |
| **P1-06** A-11 stopped at academic context | **RESOLVED** | `verify:a11` 16/16 — Plan → Course → `in_progress` → deadline → visible in Today AND Course → hard restart (browser + server killed) → all three still there, read from `context.json`, `subject-state.json`, `items.json` |
| **P1-07** UNR uncertainty not visible | **RESOLVED** | `verify:unr` 14/14 on the real UNR plan. Asserts the explanatory copy is present on Plan and Course, AND that four "you are clear" phrasings are absent. `tests/unit/unknown-vs-known-empty.test.ts` pins the semantic layer |
| **P1-08** frontend/a11y not run | **RESOLVED** | `verify:local-frontend` 25/25 — 5 new surfaces × 5 viewports, axe critical/serious/moderate/minor all 0. Cloud journey 19/20 (see P2-01) |

---

## Open — P2, deferred by severity not by convenience

### P2-01 — choosing Campus Cloud fires queries before sign-in

Startup now picks the RUNTIME, not the session, so selecting Campus Cloud
mounts the app immediately; its queries fire unauthenticated, PostgREST
answers **401**, and only then does the guard redirect to `/login`.

RLS refused them correctly. **No data was exposed and nothing was lost** — it
is a wasted round trip and four console errors that make real ones harder to
see. The cloud journey is 19/20 with only this step failing.

Not P1: it threatens no security boundary, no data semantics, no portability,
no backend equivalence and no Milestone B architecture. The runtime behaves
correctly; it is merely noisy on the way.

**Exit:** gate the `_app` queries on `!requiresAccount || session !== null`.
That needs an `enabled` flag threaded through the shared query hooks, which
are on the cloud path, so it wants its own verification rather than being
rushed in at the end of a hotfix.
