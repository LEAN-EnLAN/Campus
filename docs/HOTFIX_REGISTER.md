# Hotfix register

Unresolved **P0 / P1** findings only. Ordinary TODOs do not belong here.

A finding is P0/P1 when it threatens a security boundary, canonical data
semantics, cross-platform vault portability, backend equivalence, runtime
correctness, receipt/evidence authority, significant data loss, or architecture
Milestone B depends on.

Last updated: 2026-08-15, end of the Milestone A acceleration pass.

---

## P0-01 — `prerequisitesKnown` has no cloud-side test coverage

**Threatens:** backend equivalence, canonical academic semantics.

Migration `20260815000100` adds `prerequisites_known` / `prerequisites_note` to
`public.curricula`, and `SupabaseBackend` now reads them. That path has **not**
been executed: `pnpm test:db` was not run during this pass, so the column, the
regenerated seed and the adapter mapping are unverified together.

The local side is covered, including the synthetic `known: true, edges: []`
case. The cloud side is code that compiles and nothing more.

**Exit:** run `pnpm test:db` against a reset database and add the three semantic
cases (UTN known, UNR unknown, synthetic known-empty) to the cloud suite.

---

## P0-02 — A-10 conformance suite does not exist

**Threatens:** backend equivalence — the ADR's own stated risk.

`LocalBackend` and `SupabaseBackend` are each tested separately. There is no
single suite asserting they answer the same 16-method contract identically, so
nothing detects drift between them.

**Exit:** one semantic suite, parameterised over both adapters, covering every
method plus date round-tripping and the academic-uncertainty cases. For the
local adapter, every persistence assertion must run against a **new instance**.

---

## P1-03 — local browser journey is 8/11, and the gaps are unexplained

**Threatens:** runtime correctness.

`scripts/verify-local-journey.mjs` proves the local runtime genuinely works in a
real browser: picker → open a real folder → `LocalBackend` active → `/today` →
reload reopens the same vault → a moved vault is explained without a login
redirect and without recreating the folder.

Three checks still fail and were **not** diagnosed:

- `a fresh vault lands on onboarding, not login` — a manual probe confirms the
  app does reach `/onboarding` and renders the portable catalog (UNR and UTN
  both listed) with Supabase untouched, so this reads as a race in the check
  rather than a product defect. Unproven either way.
- `the portable catalog was read with no Supabase` — same race.
- `no console errors` — two `404` responses during the local journey. Cause
  unknown. A 404 on a catalog fetch would be material; a 404 on a dev-server
  asset would not. **Not investigated.**

**Exit:** wait on the destination rather than on elapsed time, then identify
both 404s by URL before dismissing them.

---

## P1-04 — A-11 was never run

**Threatens:** the milestone claim itself.

The full journey — choose institution → academic unit → program → curriculum →
Today → mark a subject `in_progress` → create a deadline → see it in Today and
in the Course → restart → everything persists from vault files — has **not**
been executed. Nor has the UNR uncertainty journey through the UI.

No vault has yet been written by the product: `.campus/` is created on first
authored state, and no run has reached that point.

**Exit:** complete the journey with Supabase intentionally unreachable, then
show the resulting vault tree.

---

## P1-05 — stale dev server was bound to `0.0.0.0` with TLS

**Threatens:** security boundary.

During this pass a dev server left running from an earlier session was found
listening on `0.0.0.0:5173`, from the tailnet script. The new Vault API binds to
loopback and validates Origin, but it mounts into whatever host Vite was given —
so a tailnet-exposed dev server would expose an API that reads and writes the
student's files to every host that can reach it.

The capability token and the Origin allowlist are the mitigations, and they are
real, but `--host` widening the bind is a foot-gun that currently has no guard.

**Exit:** refuse to mount the Vault API when the dev server is not bound to
loopback, unless an explicit opt-in flag is passed.
