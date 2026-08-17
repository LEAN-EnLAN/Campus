# campus-local-first-workspace — Tasks

Every task declares `implements:`. Requirement IDs come from `spec.md`.

## Linear gate — completed before any fan-out

- [x] **L-01** — Record the baseline and refuse to start dirty
      _implements:_ QUALITY-001
      _evidence:_ `37bf9d4`, candidate `cand_c8239816f161d0be557ed856`, 0 dirty files ·
      format ✔ lint ✔ typecheck ✔ test ✔ 48 · test:db ✔ 15 · build ✔ · journey 20/20 ·
      frontend 195/195 · a11y 0/0/0/0

- [x] **L-02** — Five new project skills; extend the six existing ones rather than recreate
      _implements:_ doctrine for every epic
      _evidence:_ 11 SKILL.md discoverable, valid frontmatter — `campus-local-first`,
      `campus-vault`, `campus-editor`, `campus-code-runner`, `campus-desktop`

- [x] **L-03** — Open-source study and licence gate, before any code is copied
      _implements:_ legal gate for EDITOR, KNOWLEDGE, VAULT
      _evidence:_ `docs/research/open-source-reuse.md` (780 lines),
      `THIRD_PARTY_NOTICES.md`. SilverBullet verified **MIT** at `411a6c3` (v2.10.0) —
      the only permissively licensed project studied. Obsidian proprietary; Zettlr
      GPL-3.0; Logseq, Trilium, Joplin, AppFlowy, SiYuan AGPL-3.0 → **reference only**

- [x] **L-04** — Architecture spike and ADR
      _implements:_ LOCAL-001, LOCAL-002
      _evidence:_ `docs/adr/ADR-local-first-backend.md`, accepted

- [x] **L-05** — SDD delta with twelve epics and stable IDs; the POC change is not archived
      _implements:_ all
      _evidence:_ `openspec/changes/campus-local-first-workspace/{proposal,spec,tasks}.md`

## Milestone A — local-first spine

- [x] **A-01** — `CampusBackend`: sixteen methods derived from the sixteen existing hooks
      _implements:_ LOCAL-001
      _evidence:_ `src/lib/backends/types.ts`

- [x] **A-02** — `SupabaseBackend`: today's behaviour moved behind the seam, unchanged
      _implements:_ LOCAL-002
      _evidence:_ `src/lib/backends/supabase-backend.ts` · `test:db` 15/15 · journey 20/20

- [x] **A-03** — Hooks rewired through the seam; keys, `staleTime` and invalidation untouched
      _implements:_ LOCAL-001
      _evidence:_ `src/features/{academic,items}/queries.ts` · frontend 195/195 unchanged

- [x] **A-04** — The boundary made executable
      _implements:_ LOCAL-001
      _evidence:_ `tests/unit/backend-boundary.test.ts` — 5 tests. Fails if a component,
      route, hook or the pure domain layer imports Supabase again

- [x] **A-05** — Vault format v1 documented, including conflict semantics
      _implements:_ VAULT-004, LOCAL-005
      _evidence:_ `docs/vault-format.md`

- [x] **A-06** — Portable academic catalog generated from the single source of truth
      _implements:_ ACADEMIC-001, ACADEMIC-002
      _evidence:_ `scripts/generate-catalog.mjs` → `public/academic-catalog/`.
      UTN `prerequisitesKnown: true` / 186 edges · UNR `prerequisitesKnown: false` + note.
      `tests/unit/academic-catalog.test.ts` — 10 tests, including a regeneration-diff check
      so the two catalogs cannot drift

- [x] **A-07** — `VaultRepository` over a real filesystem, with the path resolver as the
      security boundary
      _implements:_ VAULT-001, VAULT-002, VAULT-003
      _evidence:_ `src/lib/vault/` — `fs-port.ts` (the port), `node-fs.ts` (Node adapter),
      `path-resolver.ts` (pure string half), `vault-repository.ts` (filesystem half).
      34 tests: 20 on the resolver, 14 against real temp dirs and real symlinks.
      Mutation-verified — separator confusion, trailing dot/space, reserved-name
      over- and under-matching, and the dangling-symlink bypass each kill a test
      _decision:_ the vault runs on a Node adapter behind the port. VAULT-001 says
      `realpath` and VAULT-002 says fsync; the browser File System Access API has
      neither and is Chromium-only. Tauri (Milestone D) reuses the same port

- [x] **A-08** — `LocalBackend` implementing `CampusBackend` over the vault
      _implements:_ LOCAL-003
      _acceptance:_ Today, Plan, Courses, Calendar and Library work with Supabase stopped
      _evidence:_ `src/lib/backends/local/` — 26 tests. Every persistence assertion is
      made against a BRAND NEW `LocalBackend`, so no in-memory state can hide a badly
      written file. Exactly 16 methods, asserted as an equality not a superset.
      Four files under `.campus/academic/`, each with `schemaVersion: 1`, each
      changed by one read→derive→atomic-write through `VaultRepository`
      _boundary:_ `boundary.test.ts` — LocalBackend imports neither `node:fs`,
      `node:path` nor Supabase, and composes no vault paths. Verified by
      introducing the violation; two tests catch it
      _blind spot found and closed:_ the first round of tests could NOT catch the
      flag being re-derived from `prerequisites.length`, because both real plans
      agree with that derivation (UTN 186→true, UNR 0→false). Only a synthetic
      plan declaring `known: true` with zero edges tells them apart

- [x] **A-09** — `CampusRuntime` and the vault picker; `/login` preserved
      _implements:_ LOCAL-004
      _evidence:_ `src/lib/runtime/` + `src/app/` + `src/server/` — one resolution point,
      device config, real picker, `main.tsx` wired, `VaultAccess` transport with ONE
      server-side security authority, loopback-only bind guard.
      `verify:local` 12/12 in a real headless browser · `verify:bind` 10/10

- [x] **A-10** — Backend conformance suite run against both adapters
      _implements:_ LOCAL-002, LOCAL-003
      _evidence:_ `tests/db/conformance.test.ts` — 16 methods × 2 adapters, 29/29 with
      the 15 RLS tests. Caught a real divergence on its first run: SupabaseBackend
      THREW for a missing curriculum while LocalBackend answered UNKNOWN; fixed with
      `maybeSingle` and the identical UNKNOWN bundle. Mutation-verified: restoring
      `known = edges.length > 0` in both adapters kills exactly the known-empty fixture

- [x] **A-11** — Milestone A journey: open vault → select plan → create deadline → restart →
      deadline persists, with no Supabase
      _implements:_ LOCAL-003, ACADEMIC-003
      _evidence:_ `verify:a11` 16/16 with Supabase at http://127.0.0.1:1 — onboarding
      cascade → Today → Plan → Course → in_progress → linked deadline → visible in
      Today AND Course → HARD RESTART (browser + server killed) → all three persist
      from `context.json`, `subject-state.json`, `items.json`. Zero Supabase requests.
      `verify:unr` 14/14 proves UNR uncertainty in the UI the student sees;
      `verify:local-frontend` 25/25, axe 0/0/0/0
      _delivery:_ pre-commit AUTHORIZED · ready-to-commit (engineer(), review not
      required by policy). Pre-PR: blocked — gentle-ai 2.4.0-rc.8 stopped the 89-file
      / 11,766-line candidate with `lens_context_budget_exceeded` (documented contract
      behaviour: reviewer evidence is never truncated). Consent was granted, lineage
      review-4e8a971a62b1527a froze at HIGH risk / 4 lenses and cannot proceed at this
      size. Recorded as a factual external blocker; future work reviews per-commit
      candidates, which fit

## Milestone B — workspace and notes ⬜

- [ ] **B-01** — Workspace shell with tabs and split panes _implements:_ WORKSPACE-001, WORKSPACE-002
- [ ] **B-02** — Responsive adaptation; no miniature panes at 390px _implements:_ WORKSPACE-003
- [ ] **B-03** — Registries _implements:_ WORKSPACE-004
- [ ] **B-04** — Command palette, distinct from entity search _implements:_ WORKSPACE-005, KNOWLEDGE-004
- [ ] **B-05** — `VaultTree` _implements:_ WORKSPACE-006
- [ ] **B-06** — CodeMirror 6 Markdown editor _implements:_ EDITOR-001, EDITOR-002, EDITOR-003
- [ ] **B-07** — Wiki links and backlinks _implements:_ KNOWLEDGE-001, KNOWLEDGE-002
- [ ] **B-08** — Properties with round-trip preservation _implements:_ EDITOR-005
- [ ] **B-09** — Templates and daily notes _implements:_ EDITOR-006, EDITOR-007
- [ ] **B-10** — Derived SQLite index and rebuild _implements:_ VAULT-008, KNOWLEDGE-003
- [ ] **B-11** — Watcher _implements:_ VAULT-007
- [ ] **B-12** — Transactional rename _implements:_ VAULT-006

## Milestone C — executable notes ⬜

- [ ] **C-01** — Code block UI and highlighting _implements:_ CODE-001
- [ ] **C-02** — `CodeRunnerRegistry` _implements:_ CODE-002
- [ ] **C-03** — Python runner, Pyodide in a Web Worker _implements:_ CODE-003
- [ ] **C-04** — JavaScript runner _implements:_ CODE-004
- [ ] **C-05** — Executed security suite before the word "sandboxed" is used anywhere
      _implements:_ CODE-006, QUALITY-006

## Milestone D — packaging ⬜

- [ ] **D-01** — `campus serve <vault>`, loopback only _implements:_ SERVER-001, SERVER-002
- [ ] **D-02** — Tauri 2 with vault-scoped capabilities _implements:_ DESKTOP-001, DESKTOP-002
- [ ] **D-03** — Linux AppImage _implements:_ DESKTOP-004
- [ ] **D-04** — Windows build configuration _implements:_ DESKTOP-003, DESKTOP-004
      _note:_ `CONFIGURED` and `BUILT` are reachable from Linux. `RUNTIME_VERIFIED` and
      `INSTALLER_VERIFIED` require a Windows host and stay blocked until one exists

## Cross-cutting ⬜

- [ ] **X-01** — Extend `verify:frontend` to the new surfaces and seven viewports _implements:_ QUALITY-002
- [ ] **X-02** — Keyboard-only scenarios _implements:_ QUALITY-004
- [ ] **X-03** — Filesystem security suite _implements:_ QUALITY-005, VAULT-001
- [ ] **X-04** — Generated vault fixtures, tiny/medium/large _implements:_ QUALITY-008
- [ ] **X-05** — Performance baselines before any budget is set _implements:_ QUALITY-007
- [ ] **X-06** — New tester scenarios; production code stays independent _implements:_ QUALITY-009
- [ ] **X-07** — Illustration language _implements:_ DESIGN-004
- [ ] **X-08** — QuickCapture / SearchPalette: KEEP, REFACTOR or REPLACE, with a reason _implements:_ DESIGN-003
- [ ] **X-09** — Registry-driven settings _implements:_ SETTINGS-001, SETTINGS-002

## Blocked

- [ ] **BLK-01** — Protocol review receipt 🚫
      _implements:_ QUALITY-010
      _blocked on:_ reviewers need `gentle-ai review inspect-candidate` **without** Bash,
      Write or Edit. The shipped lens agents carry `Read/Grep/Glob/codegraph` only, so the
      binding cannot be honoured. Fix belongs in the harness project, not here. Campus does
      not weaken the harness to make itself green, and does not fabricate a receipt
