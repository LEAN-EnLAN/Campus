# Desktop parity inventory (web app ↔ Rust desktop)

Source of truth for the LOCAL-mode privileged side. The Rust desktop reimplements only the privileged side (vault HTTP API + catalog assets + SPA index token injection); `LocalBackend`/`academic-store` keep running unchanged in the WebView, so the on-disk format is identical by construction. Every row cites a verified `file:line`. `UNVERIFIED` marks anything not confirmed.

## 1. HTTP routes

Base prefix `/__campus/vault` (`src/server/vault-api.ts:80`). All vault endpoints are `POST` with JSON body and require header `x-campus-capability` == per-process token. Origin must be allowlisted (or absent).

| Method | Path | Body params | Success (status + JSON) | Failures (status/code/error text) | Source | Rust owner |
|---|---|---|---|---|---|---|
| POST | `/__campus/vault/open` | `path: string` (required), `create?: boolean` | 200 `{ id, name }` | 400 `bad_request` ("path required"/"create must be a boolean"); folder errors via `folderStatus` (403/400/404) | `src/server/vault-api.ts:349-368` | `campus_core::sessions` + `campus_server::api` |
| POST | `/__campus/vault/exists` | `path: string` (required) | 200 `{ exists: boolean }` | 400 `bad_request` ("path required") | `src/server/vault-api.ts:370-376` | `campus_core::sessions` |
| POST | `/__campus/vault/dirs` | `path?: string` | 200 `{ path, parent, dirs }` | 400 `bad_request` ("path must be a string"); folder errors 403/400/404 | `src/server/vault-api.ts:378-394` | `campus_core::sessions` |
| POST | `/__campus/vault/<id>/op` | `op: Operation`, `path: string`, op-specific | 200 `{ ok: true, value }` (value shape per op) | see below | `src/server/vault-api.ts:396-484` | `campus_server::api` + `campus_core::repo` |
| OPTIONS | `/__campus/vault/*` (any) | none | 204 with CORS preflight headers | — | `src/server/vault-api.ts:310-321` | `campus_server::origins` |
| GET | `/academic-catalog/<rel>` | — | 200 file stream `application/json; charset=utf-8`, `cache-control: no-cache` | 404 `{ error: 'catalog asset not found' }` JSON | `src/server/vite-catalog-plugin.ts:39-60`, `src/server/catalog-assets.ts:27-72` | `campus_server::assets` |
| GET | `/` (SPA) | — | `index.html` with `window.__CAMPUS_VAULT_TOKEN__=<token>` injected into head | — | `src/server/vite-vault-plugin.ts:101-110` | `campus-desktop` + `campus_server::assets` |

Op dispatch (`src/server/vault-api.ts:415-458`):

| op | extra body params | success value |
|---|---|---|
| `readNote` | — | `{ ok:true, value: LoadedNote { contents, mtimeMs } }` |
| `writeNote` | `contents: string`, `expectedMtimeMs: number \| null` | `{ ok:true, value: null }` |
| `listDir` | — | `{ ok:true, value: VaultEntry[] }` |
| `mkdir` | — | `{ ok:true, value: null }` |
| `rename` | `to: string` | `{ ok:true, value: null }` |
| `trash` | — | `{ ok:true, value: TrashedEntry { trashedTo } }` |
| `stat` | — | `{ ok:true, value: VaultStat \| null }` |

Refusals on `/op`: unknown vault id → 404 `unknown_vault`; unsupported op → 400 `bad_request` ("unsupported operation"); non-string path → 400 `bad_request` ("path must be a string"); non-string contents → 400 `bad_request` ("contents must be a string"); expectedMtimeMs neither null nor number → 400 `bad_request` ("expectedMtimeMs must be a number or null"); non-string `to` → 400 `bad_request` ("to must be a string"); unknown endpoint path → 404 `bad_request` ("unknown endpoint"); wrong method → 405 `bad_request` ("method not allowed"); bad JSON → 400 `bad_request` ("invalid JSON"); missing/wrong capability → 401 `unauthorized`; unlisted present origin → 403 `origin_not_allowed`; runtime vault errors → 200 if `not_found` else 400 with code (and `notFound`, `conflict` flags).

## 2. Error code catalogue

Source: `src/lib/vault/errors.ts:12-48` (list), `src/lib/vault/error-messages.ts:12-48` (English? Spanish UI strings). HTTP status mapping from `src/server/vault-api.ts` (`folderStatus` lines 283-287; op catch lines 474, and per-endpoint).

| Code | HTTP status where it occurs | English message string | Source |
|---|---|---|---|
| path_empty | 400 | "empty path"/"empty path" (VaultError default `code`) | errors.ts:65, path-resolver.ts:112,156 |
| path_absolute | 400 | "absolute paths are not vault-relative" | path-resolver.ts:126,132 |
| path_traversal | 400 | "path traversal is refused" | path-resolver.ts:73,160 |
| path_too_long | 400 | "path is too long for the Windows limit" | path-resolver.ts:137 |
| name_separator | 400 | "segment contains a separator" | path-resolver.ts:79 |
| name_control_char | 400 | "name contains a control character" | path-resolver.ts:83 |
| name_forbidden_char | 400 | "name contains a forbidden character" | path-resolver.ts:86 |
| name_trailing_dot_space | 400 | "name has a trailing dot or space" | path-resolver.ts:93 |
| name_reserved | 400 | `"<STEM>" is a reserved device name` | path-resolver.ts:99 |
| outside_vault | 400 | "path resolves outside the vault" | vault-repository.ts:87 |
| too_many_links | 400 | "too many symbolic links" | vault-repository.ts:126 |
| symlink_unreadable | 400 | "symlink is not readable" | vault-repository.ts:132 |
| root_unreadable | 400 | "vault root is not readable" | vault-repository.ts:80 |
| not_found | 200 (op) / 404 (folder) | "not found" | vault-repository.ts (various); vaultErrorFromSystem errors.ts:111 |
| already_exists | 400 | `"expected a new file, but one already exists on disk"` on the wire (detail only, `vault-api.ts:480`; the in-process message is `<path>: expected a new file, but one already exists on disk`) (VaultConflictError detail) | vault-repository.ts:200 |
| destination_exists | 400 | `"the destination already exists"` on the wire (detail only, `vault-api.ts:480`; the in-process message is `<path>: the destination already exists`) | vault-repository.ts:239 |
| conflict_changed | 400 | `"the file changed on disk after it was loaded"` on the wire (detail only, `vault-api.ts:480`; the in-process message is `<path>: the file changed on disk after it was loaded`) | vault-repository.ts:215 |
| conflict_missing | 400 | `"the file was deleted or moved after it was loaded"` on the wire (detail only, `vault-api.ts:480`; the in-process message is `<path>: the file was deleted or moved after it was loaded`) | vault-repository.ts:209 |
| permission_denied | 403 (folder) / 400 (op) | "permission denied" | vaultErrorFromSystem errors.ts:114 |
| io_error | 400 | "the operation failed" | vaultErrorFromSystem errors.ts:126 |
| folder_not_absolute | 400 | "path is not absolute" | vault-api.ts:140,193 |
| folder_not_found | 404 | "vault not found" | vault-api.ts:151,157,166 |
| folder_not_directory | 404 | "not a directory" | vault-api.ts:167 |
| folder_outside_roots | 403 | "folder is outside the allowed roots" | vault-api.ts:145,162,248 |
| unauthorized | 401 | "missing or invalid capability" | vault-api.ts:325 |
| origin_not_allowed | 403 | "origin not allowed" | vault-api.ts:307 |
| unknown_vault | 404 | "unknown vault" | vault-api.ts:403 |
| bad_request | 400/404 (unknown endpoint) / 405 | "method not allowed" / "invalid JSON" / "path required" / etc. | vault-api.ts:333,343,352,... |
| unavailable | (client-side only) | (no server emit; client maps network/HTML to unavailable) | http-vault-access.ts:56,63 |
| unknown | 400 (fallback) | "the operation failed"? server emits `io_error` for unknown errno; `unknown` only client fallback | errors.ts:98 |

## 3. Path-safety rules

- `isSafeSegment` / `segmentFault` / `validateVaultPath` — pure string validation (MAX_RELATIVE_PATH=200, reserved DOS names, forbidden chars, control chars, trailing dot/space, traversal, absolute forms). `src/lib/vault/path-resolver.ts:22-163` (MAX_RELATIVE_PATH line 22; RESERVED line 25; FORBIDDEN_CHARS line 34; CONTROL_CHARS line 37; isSafeSegment line 65; segmentFault line 69; validateVaultPath line 111). Rust owner: `campus_core::paths`.
- `VaultRepository.resolve` — resolves symlinks hop-by-hop (MAX_LINK_HOPS=40), containment vs real root, deepest-existing realpath defence-in-depth. `src/lib/vault/vault-repository.ts:21,72-162`. Rust owner: `campus_core::paths` + `campus_core::fs`.
- `VaultRepository.require` — throws VaultError on failed resolve. `src/lib/vault/vault-repository.ts:164-170`.
- `VaultSessions.admit` — roots check (textual + real), symlink escape, dir check, ensureFolder one-level creation. `src/server/vault-api.ts:139-201`. Rust owner: `campus_core::sessions`.
- `VaultSessions.realRoots` — resolves allowed roots; missing root allows nothing. `src/server/vault-api.ts:171-182`.
- `vault-roots.parseAllowedRoots` / `isInsideAny` — env parse, strict. `src/server/vault-roots.ts:42-73`. Rust owner: `campus_core::sessions`.
- `catalog-assets.resolveCatalogAsset` — catalog path safety (prefix, decode, no `..`, no backslash, no null, containment). `src/server/catalog-assets.ts:27-72`. Rust owner: `campus_server::assets`.

## 4. On-disk vault format

Academic files under `.campus/academic/` (academic-store.ts:21,33): envelope `{ schemaVersion: 1, <key>: ... }` (academic-store.ts:102, SCHEMA_VERSION=1 at line 19).

| Path | Key | Writer |
|---|---|---|
| `.campus/academic/context.json` | `context` | `academic-store.ts` via `LocalBackend.academic.saveContext` (local-backend.ts:146) |
| `.campus/academic/subject-state.json` | `states` | `local-backend.ts:194` (setSubjectStatuses) |
| `.campus/academic/items.json` | `items` | `local-backend.ts:264,272,281` |
| `.campus/academic/resources.json` | `resources` | `local-backend.ts:307,315` |
| `.campus/academic/manual-subjects.json` | `subjects` | `local-backend.ts:175,223,234` |

Trash (vault-repository.ts:281-309): `.campus/trash/<base36ms>-<rand4>-<name>` (unique at line 290-291) + sidecar `<trashed>.meta.json` containing `{ originalPath, trashedAt }` (line 303-307). `shortTrashName` caps 80 chars (line 35-44).

Temp files: `.campus-tmp-<pid>-<ms>-<rand>` in same directory as target, written by `node-fs.writeFileAtomic` (node-fs.ts:61-64). Rust owner: `campus_core::fs`.

User notes: arbitrary vault-relative files read/written via VaultRepository (readNote/writeNote) — content is UTF-8 string; mtime-based conflict detection.

## 5. LocalBackend methods

All run unchanged in the WebView; Rust owner = "unchanged (WebView)". File: `src/lib/backends/local/local-backend.ts`.

| Method | Files touched | file:line |
|---|---|---|
| catalog.institutions / academicUnits / programs / curricula / curriculumBundle | portable catalog (read-only) | local-backend.ts:69-119 |
| academic.context | `.campus/academic/context.json` | local-backend.ts:125-133 |
| academic.saveContext | context.json | local-backend.ts:135-154 |
| academic.subjectStates | subject-state.json | local-backend.ts:156-164 |
| academic.setSubjectStatus / setSubjectStatuses | subject-state.json or manual-subjects.json | local-backend.ts:166-201 |
| academic.manualSubjects | manual-subjects.json | local-backend.ts:203-211 |
| academic.addManualSubject | manual-subjects.json | local-backend.ts:213-231 |
| academic.removeManualSubject | manual-subjects.json | local-backend.ts:233-241 |
| items.list / create / update / setDone / remove | items.json | local-backend.ts:246-285 |
| resources.list / create / remove | resources.json | local-backend.ts:287-319 |

## 6. CLI commands and MCP tools

CLI: `packages/campus-cli/bin.mjs`. MCP: `packages/campus-mcp/server.mjs` (stdio, shells out to CLI). Both run on Node in-process over VaultRepository against the same folder. Rust owner = "unchanged (Node); Rust port deferred".

CLI commands (from usage, lines 17-34): `status`; `subjects list`; `subjects set SUBJECT_ID STATUS [--grade 1-10] [--manual]`; `tasks list`; `tasks create --title ...`; `tasks done ID [--undo]`; `tasks remove ID`; `resources list`; `resources create ...`; `resources remove ID`; `catalog institutions`.

MCP tools (server.mjs:31-97): campus_status, campus_subjects_list, campus_tasks_list, campus_resources_list, campus_task_create, campus_task_done, campus_task_remove, campus_resource_create, campus_resource_remove, campus_subject_set_status. Write tools gated by `--allow-write`.

## 7. Browser-only state

- `localStorage` key `campus.device.v1` — recent vaults + last runtime (`src/lib/runtime/device-config.ts:16`). Lives in WebView origin.
- `campus.theme` (`src/lib/theme/theme.ts:22`), `campus.accent-hue` (line 46).
- `campus.dismissed-order-notes` (`src/features/academic/dismissed-notes.ts:12`).
- `campus.workspace.v1:<vaultPath>` — per-vault layout (`src/lib/workspace/model.ts:273`), stored via `workspaceStorageKey`.
- Desktop must keep a STABLE WebView origin so these persist. Decision: the Tauri shell serves everything through the custom protocol `campus://localhost` (WebView2 origin `http://campus.localhost`), which never changes between launches — see `desktop/src-tauri/src/main.rs`.

## 8. Security

- Bind guard: `assertLoopbackBind` / `classifyBind` — loopback only. `src/server/bind-guard.ts:36-102`. Env: none (host from Vite server config).
- Origin allowlist: `vaultAllowedOrigins` / `extraAllowedOrigins` / `loopbackOrigins`. `src/server/vault-origins.ts:24-69`. Env: `CAMPUS_VAULT_ALLOWED_ORIGINS` (`src/server/vault-origins.ts:19`).
- Capability token: `mintToken()` 32 random bytes base64url, injected as `window.__CAMPUS_VAULT_TOKEN__`. `src/server/vault-api.ts:83-85`, `src/server/vite-vault-plugin.ts:30,101-110`. Rust owner: `campus_server::assets` + `campus-desktop`.
- Allowed roots: `CAMPUS_VAULT_ALLOWED_ROOTS` (env name `src/server/vault-roots.ts:19`), parsed by `parseAllowedRoots` (line 42). Default home dir.
- Disable API: `CAMPUS_VAULT_API=off` (`src/server/vite-vault-plugin.ts:35`).
- Rust owners: `campus_server::bind`, `campus_server::origins`, `campus_core::sessions`.

## 9. Existing tests to port (relevant privileged-side tests)

Counts are `it()` cases. Scenario names listed.

### src/server/vault-api.test.ts (24) — listed above in extract; key scenarios: traversal, symlink escape, wire conflict, origin/capability/vault refusals, unknown endpoint, GET refusal, opaque id, missing vault, non-dir path.

### src/server/vault-api-roots.test.ts (14)
opens a folder under an allowed root; opens the allowed root itself; refuses a folder outside every allowed root, with a code; does not tell a missing folder from an existing one outside the roots; refuses dot-dot that climbs out of an allowed root; refuses a symlink inside the home that points outside it; allows a symlink inside the home that stays inside it; tells missing, not-a-folder and relative apart inside the roots; a vault opened under the roots then works as before; is true for a folder under the roots; is false for a missing folder under the roots; never reveals anything outside the roots: existing and missing look identical; does not follow a link out of the roots; is the user home directory.

### src/server/vault-api-errors.test.ts (12)
a security refusal is outside_vault; a missing note is not_found and notFound; a name the vault refuses keeps its path-validation code; creating over an existing note is an already_exists conflict; renaming a missing file is not_found, and never leaks the host path; an unexpected filesystem error is a generic code with no host path in it; a conflict message names the path once, not twice; dup.md; no capability is unauthorized; a foreign origin is origin_not_allowed; an unknown vault id is unknown_vault (the server restarted); malformed input is bad_request.

### src/server/vault-api-dirs.test.ts (17)
lists directories only, as plain names, sorted; never returns file names, contents, sizes or times; hides dot-folders; says where it is, and the parent while that is still inside the roots; with no path, starts at the first allowed root; refuses anything outside the allowed roots; refuses dot-dot that climbs out; refuses to list through a symlink that leaves the roots; does not even NAME an entry whose link leaves the roots; does name a link that stays inside the roots; tells missing, not-a-folder and relative apart INSIDE the roots; an allowlist of its own is respected; with no usable root, nothing can be listed; refuses a missing or wrong capability, before parsing; refuses a foreign origin; refuses a non-POST method; refuses a non-string path.

### src/server/vault-api-create.test.ts (8)
without create, a missing folder is still just missing; creates the folder and opens it; opens a folder that already exists without touching it; makes one level only: a missing parent is not created; refuses to create outside the allowed roots; refuses a `..` that climbs out of the roots; refuses to create through a symlink that points out of the roots; needs a real boolean.

### src/server/vault-roots.test.ts (10), vault-origins.test.ts (8), bind-guard.test.ts (5), catalog-assets.test.ts (7) — counts above; scenarios in extract output.

### src/server/transport-integration.test.ts (6)
binds to loopback, never to every interface; a deadline written through HTTP lands in the real folder; a brand new backend over a brand new session reads it back; subject state survives the round trip; the transport does not change the meaning of prerequisitesKnown; a hostile path still cannot escape, even through the whole stack.

### src/lib/vault/path-resolver.test.ts (20), vault-repository.test.ts (18), vault-containment.test.ts (15), http-vault-access.test.ts (14), errors.test.ts (13) — counts above.

### src/lib/backends/local/local-backend.test.ts (22), boundary.test.ts (4).

## 10. Gaps (not implemented in web app today)

Grepped `src/` for 'watch', 'index.sqlite', 'trash' restore, 'rename-updates-links':

- **Watchers / file watching**: no `fs.watch`/watcher usage in `src/`. grep 'watch' only hits tests/docs strings; no live watcher. Rust owner `campus_core::fs` deferred — not in web app.
- **SQLite index**: no `index.sqlite` anywhere in `src/`. `src/lib/knowledge/vault-index.ts` and `session-index.ts` exist but grep evidence: no SQLite file produced. Not implemented.
- **Restore from trash**: `trash` moves to `.campus/trash/` with sidecar, but no `restore`/`untrash` method in `VaultAccess` (`src/lib/vault/vault-access.ts`) or `VaultRepository`. Restore is manual via file manager (doc comment at vault-repository.ts:301). Not implemented programmatically.
- **Rename-updates-links**: `rename` is plain rename; no link rewriting. `src/lib/vault/vault-repository.ts:226-244`. Not implemented.
- **Full-text search index**: `src/domain/search*.ts` and `src/lib/knowledge/*` exist but are client-side over loaded content; no server-side search endpoint. Grep 'search' in src/server → none. Not implemented server-side.

Rust owners reference: `campus_core::paths`, `campus_core::errors`, `campus_core::fs`, `campus_core::repo`, `campus_core::sessions`, `campus_core::collate` (localeCompare 'es'), `campus_server::api`, `campus_server::origins`, `campus_server::bind`, `campus_server::assets`, `campus-desktop`.
## 11. Rust port status (T2)

| Area | Rust module | Evidence |
|---|---|---|
| Error codes + errno mapping | `campus_core::errors` | unit tests (code list order pinned to `VAULT_ERROR_CODES`) |
| Path validation | `campus_core::paths` | 13 tests ported from `path-resolver.test.ts` |
| Node `fs` semantics (mtimeMs arithmetic, lossy UTF-8, atomic write + fsync, Win32 verbatim-prefix stripping) | `campus_core::fs` | unit tests |
| Repository (resolve walk, read/write/conflicts, rename, listDir, mkdir, trash, stat) | `campus_core::repo` | 26 tests ported from `vault-repository.test.ts` + `vault-containment.test.ts` (links via symlink or junction) |
| Sessions, allowed roots, `dirs`, `exists`, `open {create}` | `campus_core::sessions` | 7 unit tests + api tests |
| `localeCompare(_, 'es')` ordering | `campus_core::collate` | pinned against Node 24 output (45 names) |
| HTTP handler | `campus_server::api` | 20 tests ported from `vault-api*.test.ts` |
| Origins / bind guard | `campus_server::origins`, `campus_server::bind` | ported from `vault-origins.test.ts`, `bind-guard.test.ts` |
| Catalog + static + token injection | `campus_server::assets` | ported from `catalog-assets.test.ts` + SPA tests |
| **Node vs Rust contract** | `desktop/scripts/contract.mjs` | 75 identical request/response pairs (status, contract headers, JSON body) against the real `src/server/vault-api.ts` |

Known, documented divergences (desktop only, not reachable from the React app):
- A catalog URL that `resolveCatalogAsset` refuses falls through to Vite's SPA fallback in dev (200 + index.html); the Rust server answers the honest JSON 404 instead.
- A JSON body that is `null` makes the Node handler throw (the request hangs in the Vite plugin); Rust treats any non-object body as `{}` and answers `400 bad_request`.
- Collation is a compact table (CLDR root punctuation order, Latin accents, Spanish `ñ`), not full ICU; identical for the names tested, may differ for exotic scripts.
- CLI (`packages/campus-cli`) and MCP (`packages/campus-mcp`) are not ported: they keep running on Node over the same vault folder, which the Rust server reads and writes in the identical format.
