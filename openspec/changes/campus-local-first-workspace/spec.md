# campus-local-first-workspace — Requirements

Twelve epics with stable IDs. The POC's `CAP-*` requirements remain binding and are not
restated here.

Status legend: **✅ met** · **🚧 in progress** · **⬜ not started** · **🚫 blocked**

---

## LOCAL — runtime modes and the backend seam

### LOCAL-001 — CampusBackend is the only data seam 🚧

No component or hook imports `@supabase/supabase-js`. Hooks depend on `CampusBackend`.

- **GIVEN** any file under `src/components/**` or `src/routes/**`
  **THEN** it contains no Supabase import
- **GIVEN** `src/features/**/queries.ts`
  **THEN** it awaits backend methods, not `supabase.from(...)`
- **AND** TanStack Query keys, `staleTime` and invalidation are unchanged

### LOCAL-002 — Supabase becomes one adapter ⬜

The cloud implementation lives behind `src/lib/backends/supabase/**` and passes the same
conformance suite as the local one.

- **GIVEN** the CLOUD runtime **THEN** `pnpm test:db` and the POC journey pass unchanged

### LOCAL-003 — LOCAL mode requires no account, no network, no Supabase ⬜

- **GIVEN** the Supabase stack stopped and the network unavailable
  **WHEN** the student opens a vault
  **THEN** Today, Plan, Courses, Calendar and Library work
- **AND** no code path fabricates a Supabase user

### LOCAL-004 — runtime selection ⬜

`CampusRuntime` is `{mode:'local', vault, profile}` or `{mode:'cloud', session}`, chosen once
at the provider. `/login` still works. No component branches on the mode.

### LOCAL-005 — conflict semantics documented, not built ⬜

`docs/vault-format.md` records how file content, academic metadata, device settings and cloud
identity conflict differently. Last-write-wins is never an implicit global default.

---

## VAULT — the student's folder

### VAULT-001 — path resolution is the security boundary ⬜

Every filesystem path is resolved (`realpath`) and required to be inside the vault root
**before** any I/O.

- traversal `../../../etc/passwd` → rejected
- absolute escape `/etc/passwd` → rejected
- traversal after a valid segment → rejected
- symlink pointing outside the vault → not followed, surfaced
- rename or attachment target outside the vault → rejected
- malformed filename (NUL, control chars, over-long) → rejected

### VAULT-002 — atomic writes ⬜

Writes go to a temporary file in the same directory, are fsynced, then renamed over the
target. A crash mid-write never truncates a note.

### VAULT-003 — external change is never silently overwritten ⬜

- **GIVEN** a file open in Campus **AND** modified on disk afterwards
  **WHEN** Campus saves **THEN** a conflict is surfaced and the student decides
- Campus re-stats before writing; it does not trust the mtime it loaded with

### VAULT-004 — vault lifecycle ⬜

create · open · list · read · write · create note · create folder · rename · move ·
delete-to-trash · restore · attach file · recent · favourites.

### VAULT-005 — trash, not unlink ⬜

Delete moves to `.campus/trash/` with enough metadata to restore the original path.

### VAULT-006 — rename is transactional and never guesses ⬜

A rename updates every wiki link pointing at the file, reports how many files changed, and
**asks** when a link target is ambiguous rather than silently retargeting.

### VAULT-007 — watcher ⬜

Recursive over the vault only, debounced, rename-aware, bounded, ignoring `.campus` derived
files. Never watches `$HOME`. Large-vault behaviour is tested.

### VAULT-008 — derived index is rebuildable ⬜

- **GIVEN** `.campus/index.sqlite` deleted **WHEN** Campus starts
  **THEN** the index rebuilds and **no note or academic data is lost**

---

## WORKSPACE — the shell

### WORKSPACE-001 — evolve AcademicShell, do not stack a second shell ⬜

### WORKSPACE-002 — tabs and split panes on desktop ⬜

Horizontal and vertical split, resizable, close pane, move tab, back/forward, persistent
layout across restart.

### WORKSPACE-003 — responsive adaptation ⬜

Tablet: main surface plus drawers. Mobile: single surface, bottom nav, sheets.
**No miniature desktop panes at 390px.**

### WORKSPACE-004 — registries ⬜

`CommandRegistry`, `ActionRegistry`, `ViewRegistry`, `PanelRegistry`, `SettingsRegistry`,
`EditorExtensionRegistry`, `CodeRunnerRegistry`, `TemplateRegistry`. Features register
capabilities; no giant switch. Internal extensibility only — no public plugin marketplace.

### WORKSPACE-005 — command palette ⬜

`Cmd/Ctrl+P`. Distinct from entity search. `Cmd/Ctrl+K` may remain Quick Capture.

### WORKSPACE-006 — VaultTree ⬜

Nested folders, expand/collapse, selection, open, inline rename, drag-and-drop move, new
note/folder, delete, context menu, full keyboard navigation, external-change refresh,
dirty/conflict state. Reflects the real filesystem. Virtualise only after profiling.

---

## EDITOR — Markdown

### EDITOR-001 — Markdown is the only document model ⬜

Canonical source on disk. No parallel block store. Editing in `vim` and returning agrees.

### EDITOR-002 — CodeMirror 6 with one concern per extension ⬜

No 2,000-line editor component. Extensions unit-testable without React.

### EDITOR-003 — Markdown feature set ⬜

Headings, lists, task lists, links, images, tables, quotes, callouts, math, code fences,
frontmatter, wiki links.

### EDITOR-004 — Edit and Reading modes ⬜

### EDITOR-005 — properties round-trip ⬜

- **GIVEN** frontmatter with unknown keys, comments and nested maps
  **WHEN** one property is edited through the UI
  **THEN** only the intended line changes

### EDITOR-006 — templates are normal vault files ⬜

Daily · Lecture · Assignment · Exam · Reading · Course overview · Project.
Variables `{{date}} {{time}} {{title}} {{subject}}`.

### EDITOR-007 — daily notes ⬜

`Daily/YYYY-MM-DD.md`. Today (academic operational view) and Daily Note (freeform surface)
stay distinct.

---

## KNOWLEDGE — links, backlinks, search

### KNOWLEDGE-001 — wiki links ⬜ `[[Nota]]` and `[[Nota|Alias]]`, autocomplete, broken-link state.

### KNOWLEDGE-002 — backlinks ⬜ derived, rebuildable, shown in the context sidebar.

### KNOWLEDGE-003 — vault search over derived FTS ⬜

Targets file, title, body, heading, tag, property, subject. Filters `subject: tag: type:
path: after: before:` added incrementally. The in-memory `src/domain/search.ts` is preserved
for entity search.

### KNOWLEDGE-004 — command search and content search are separate concepts ⬜

---

## CODE — executable notes

### CODE-001 — opening a note never executes anything ⬜

Not on open, preview, index, search, hover or template insertion. Execution is always an
explicit action.

### CODE-002 — runner registry ⬜

Runners register themselves and report availability in Settings in words a student
understands. No switch over language names.

### CODE-003 — Python runner (Pyodide, Web Worker) ⬜

stdout, stderr, timeout, terminate, reset, duration. Never on the main thread.

### CODE-004 — JavaScript runner ⬜ worker or iframe isolation, timeout, terminate, console capture, no host API access.

### CODE-005 — container runners, optional, default disabled ⬜

Rootless preferred. `network: none`, no privileged, no container socket, **vault never
mounted writable**, ephemeral workspace, CPU/memory/pids/wall limits, output cap.

### CODE-006 — the word "sandboxed" requires evidence 🚫

Blocked until executed: infinite loop, huge stdout/stderr, memory pressure, terminate
mid-run, filesystem access attempt, network attempt, process spawn attempt, vault write
attempt, host file read attempt — each with a recorded result.

### CODE-007 — package installation is explicit ⬜ No silent downloads because a snippet imported something.

---

## ACADEMIC — the part only Campus has

### ACADEMIC-001 — portable academic catalog 🚧

`public/academic-catalog/` is **generated** from the same verified JSON that produces
`supabase/seed.sql`. One source of truth. Preserves `sourceUrl`, `sourceKind`, `retrievedAt`
and per-subject `verified`.

### ACADEMIC-002 — unknown prerequisites survive into LOCAL mode ⬜

**GIVEN** a curriculum whose faculty has not published correlatividades
**THEN** Campus says so explicitly and never renders an empty list as "nothing blocks you".
This is the epistemic invariant inherited from CAP-PLAN-002.

### ACADEMIC-003 — selected academic context is written into the vault ⬜

`.campus/academic/{context,curriculum,subject-state,items}.json`, human-readable.

### ACADEMIC-004 — Course workspace ⬜

Overview · Notes · Tasks · Resources · Code · Academic — a semantic view over vault files
plus academic metadata, never a hidden object store.

### ACADEMIC-005 — student workflows ⬜ Lecture, Assignment, Exam, each landing as real files under the Course.

### ACADEMIC-006 — a note declares its subject ⬜

`subject: arquitectura` in frontmatter is enough for the note to appear in that Course.

---

## DESKTOP · SERVER

### DESKTOP-001 — Tauri capabilities are vault-scoped, granted at runtime ⬜ Never `$HOME`, never `**`.

### DESKTOP-002 — native folder dialog, recent vaults, window persistence ⬜ Vault paths are device-scoped settings and never sync.

### DESKTOP-003 — Windows/Linux filename rules applied strictly everywhere ⬜

Reserved names, path length, trailing dots — a vault made on Linux must open on Windows.

### DESKTOP-004 — packaging claims separated ⬜

`CONFIGURED` / `BUILT` / `RUNTIME_VERIFIED` / `INSTALLER_VERIFIED`, per platform. A Windows
installer cannot be runtime-verified from Linux.

### SERVER-001 — `campus serve <vault>` binds loopback ⬜ Never `0.0.0.0` without an explicit user choice.

### SERVER-002 — server-side scope enforcement ⬜ The HTTP layer does not trust the client; traversal and symlink escape rejected server-side.

---

## DESIGN

### DESIGN-001 — workspace depth without clutter ⬜ Target adds "Esta carpeta es mi facultad."

### DESIGN-002 — shadcn as behaviour, not as design language ⬜

### DESIGN-003 — QuickCapture and SearchPalette: KEEP / REFACTOR / REPLACE with a stated reason ⬜

They carry deliberate accessibility fixes. A replacement must prove no regression.

### DESIGN-004 — original illustration language ⬜

empty-vault · first-note · empty-course · no-search-results · offline ·
unknown-prerequisites · blocked-subject · exam-week · code-runner-disabled. Original SVG,
light/dark, token-driven, correct aria semantics. Only where they add understanding.

### DESIGN-005 — restrained motion, `prefers-reduced-motion` respected ⬜

---

## SETTINGS

### SETTINGS-001 — registry-driven sections ⬜

General · Appearance · Vault · Editor · Files & Links · Academic · Calendar · Code · Hotkeys ·
Cloud · Advanced.

### SETTINGS-002 — setting scopes ⬜

`device` · `vault` · `cloud-account`. **Device-specific filesystem paths never sync.**

---

## QUALITY

### QUALITY-001 — POC evidence does not regress ✅ (baseline recorded)

48 unit · 15 RLS · journey 20/20 · frontend 195/195 · a11y 0/0/0/0.

### QUALITY-002 — verify:frontend is extended, not replaced ⬜

Viewports grow to 360, 390, 768, 1024, 1280, 1440, 1920. New surfaces: vault picker, file
explorer, editor, reading mode, properties, settings, command palette, context menu, split
panes, course workspace, code blocks, runner output, search.

### QUALITY-003 — Xvfb protection preserved ✅

Headless by default; pinned `:99` when headed; never hunt for `:0`.

### QUALITY-004 — keyboard-only scenarios ⬜

VaultTree, tabs, resizable panes, command palette, search, editor, context menu, properties,
code controls, settings. `critical > 0` or `serious > 0` still blocks.

### QUALITY-005 — filesystem security suite executed ⬜ VAULT-001's list, each with a recorded result.

### QUALITY-006 — code-runner security suite executed 🚫 Blocked with CODE-006.

### QUALITY-007 — performance measured, not guessed ⬜

Cold vault open, initial index, incremental index, single external edit, rename propagation,
search p50/p95, open note, backlink query, 5k-note memory. Budgets set **after** baselines exist.

### QUALITY-008 — generated vault fixtures ⬜

tiny / medium / large (5,000+ notes, deep folders, thousands of links, broken links,
attachments). Deterministic generator — do not commit thousands of files.

### QUALITY-009 — tester tooling extended, never replaced ⬜

New scenarios: `local-empty-vault`, `local-course`, `local-large-vault`,
`local-external-edit`, `local-conflict`, `local-broken-link`, `local-missing-attachment`,
`editor-long-note`, `editor-code`, `editor-properties`, `runner-disabled`,
`runner-python-ok`, `runner-python-timeout`, `runner-python-error`, `container-unavailable`,
`workspace-desktop`, `workspace-tablet`, `workspace-mobile`, `dark-mode`,
`UNR-unknown-prerequisites`, `UTN-blocked-subject`. Production code stays independent of it.

### QUALITY-010 — receipt obtained honestly 🚫

The prior authorization was refused for lack of a protocol receipt. Reviewers need
`inspect-candidate` **without** Bash, Write or Edit. Route a bounded harness repair through
the harness project; never weaken the harness to make Campus green, and never fabricate a
receipt.
