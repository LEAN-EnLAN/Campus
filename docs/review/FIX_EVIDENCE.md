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
