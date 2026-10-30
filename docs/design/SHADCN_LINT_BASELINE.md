# @shadcn/lint baseline

Captured at `f75b81b` + plugin registration (T3, 2026-10-30). Command: `pnpm lint:shadcn`.

Setup follows <https://github.com/shadcn-ui/lint/blob/main/SETUP.md>: the plugin is registered in `eslint.config.js` with **no rules enabled** and `settings.shadcn.componentImports = ^@/components/ui(/|$)`. `pnpm lint` is unchanged (0 errors, same 16 Fast Refresh warnings). The audit rules live in `eslint.shadcn.config.js`, opt-in: choosing rules is a design decision, and the request to measure the baseline is what enables them here.

| Rule                            | Findings |
| ------------------------------- | -------- |
| shadcn/no-unknown-classes       | 212      |
| shadcn/no-arbitrary-values      | 39       |
| shadcn/no-inline-styles         | 34       |
| shadcn/no-restyle               | 13       |
| shadcn/no-raw-colors            | 10       |
| shadcn/require-static-classes   | 0        |
| **Total**                       | **308**  |

`no-unknown-classes` is 133 unique hand-written classes (`blue-*`, `campus-blue-*`, `campus-status-*`) defined in `src/styles/*.css`, which are imported from route modules instead of the stylesheet that imports Tailwind, so the linter cannot see them.

## Top files

| File                                          | Findings |
| --------------------------------------------- | -------- |
| src/features/settings/settings-screen.tsx     | 56       |
| src/routes/onboarding.tsx                     | 36       |
| src/components/academic-shell.tsx             | 28       |
| src/features/blue/blue-today-screen.tsx       | 24       |
| src/routes/\_app/courses.index.tsx            | 19       |
| src/routes/login.tsx                          | 19       |
| src/routes/\_app/plan.tsx                     | 17       |
| src/routes/\_app/library.tsx                  | 13       |
| src/routes/\_app/courses.$courseId.tsx        | 12       |
| src/features/calendar/campus-calendar.tsx     | 11       |
| src/components/ui/kanban-board.tsx            | 10       |
| src/components/ui/dot-matrix.tsx              | 9        |
