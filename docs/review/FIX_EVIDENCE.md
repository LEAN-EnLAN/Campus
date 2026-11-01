# T4 resumed writer: F04 and F05

This document covers only the resumed F04/F05 writer work. F01 `43d18b9`, F02
`b8546ce`, and F03 `432142b` remain unchanged in branch history.

| Finding | Change                                                                                                           | RED                                                 | Final focused GREEN                           |
| ------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| F04     | Validate object payload after authorization; contain unexpected Vite handler rejection with generic no-store 500 | 7 failed, 2 passed; one unhandled rejection         | 12 server files, 145 passed, 4 existing skips |
| F05     | Report external deletion, preserve buffer, invalidate missing disk baseline, require explicit recovery           | 5 failed, 20 passed; two further recovery RED cases | 3 files, 45 passed                            |

F04 commit: `3933a5a` (`fix(vault): validate payloads and contain handler rejections`).
F05 is committed together with this summary.

Both fixes passed focused ESLint, Prettier, and project typecheck (exit 0).
Exact commands, failures, final output tails and review notes are retained in:

- `docs/review/evidence/fixes/F04/README.md`, `red-isolated.log`, `green.log`,
  `lint.log`, `format.log`, `typecheck.log`.
- `docs/review/evidence/fixes/F05/README.md`, `red.log`, `red-recovery.log`,
  `red-keep-mine.log`, `green-baseline.log`, `lint.log`, `format.log`, `typecheck.log`.

The evidence directory is Git-ignored and retained locally. The initial F04
AbortSignal harness mismatch and test-hook TypeScript failure are preserved in
separate logs; neither is represented as a passing check.

Separate source self-review was completed before each commit. Parent independent
review remains pending; no child agents were spawned. T2 received a shared-board
notice for Rust parity of the new non-object payload refusal. Rust parity and
full delivery verification are not claimed by this writer.

Generated `src/routeTree.gen.ts`, parent review reports and pre-existing evidence
were neither edited nor staged. No merge, push or deployment was performed.
Engram tools were not exposed. Skill resolution: `paths-injected` (all five
requested exact paths loaded; TDD and verification references also loaded).

## F09: serialize vault check and replace across repositories

The F09 regression reproduces acknowledged data loss with two distinct
LocalBackend/VaultRepository instances targeting one temporary physical vault.
RED: 5 failed / 3 passed, including both missing and existing `items.json`.
The unsafe outcome acknowledged Writer A but retained only Writer B.

`VaultRepository.writeNote` now shares per-resolved-path exclusion across
repository and adapter instances in one JS module. Containment, path identity
and the caller's mtime are revalidated inside exclusion before mkdirp/atomic
replacement. Stale callers receive typed conflicts, with no silent retry.
Windows case aliases share exclusion; different files proceed independently.
Queue failures release successors and idle keys are removed.

Executed on the F09 source hashes recorded in the local evidence:

- Focused regression: 10 passed, no skips (exit 0).
- Final vault/local-backend/conformance/manual-subjects: 12 files, 204 passed,
  9 existing skips (exit 0). This includes all 10 F09 regressions.
- Initial vault/local-backend/server: 22 files, 300 passed, 13 existing skips
  (exit 0); final server rerun is in `F09/green-server-final.log`.
- Backend conformance/manual/boundary: 53 passed, 1 failed (exit 1). The existing
  boundary scanner flags the F01 `Session` type import in
  `src/features/auth/query-isolation.test.tsx`; both files match base `043d6cf`.
  F01 remains intact. Conformance 16/16 and manual-subjects 33/33 pass.
- Project typecheck and focused ESLint: exit 0. Focused format is recorded in
  `docs/review/evidence/fixes/F09/format-commit.log`.

Evidence, exact commands/exits, source hashes and scope limits:
`docs/review/evidence/fixes/F09/README.md` and adjacent raw logs (Git-ignored,
retained locally). The unusually long related-suite elapsed time is retained
without a performance claim. No run here is final integrated verification.

**Remaining risk:** this is same-module/process serialization, not OS CAS.
Separate processes/workers/module copies, Rust and noncooperating editors can
still race the final check/write interval. Mtime collisions, arbitrary external
path swaps, and concurrent rename/trash are not solved. T2 was notified on the
shared board; cross-process integrity is not claimed. No API/schema/dependency
change. Parent independent review remains pending. No generated route tree,
parent report, UI, Rust or other-agent evidence edited/staged; no push/merge/deploy.
Engram unavailable; `skill_resolution=paths-injected`.
