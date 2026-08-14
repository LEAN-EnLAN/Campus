# Open-source reuse — licence gate

**Status:** gate document. Nothing external gets copied into `src/` until it has a block here.
**Reviewed:** 2026-08-14
**Author's note:** this document is written in English on purpose. The rest of `docs/` is
Spanish-first, but licence statements are read by people who did not write them, sometimes
years later, sometimes not in Spanish. Precision beats voice here.

## Why this document exists

Campus starts as a Supabase-backed academic tracker (`docs/PRD.md`) and is heading toward a
local-first workspace over the student's own folder of Markdown notes. That second half is a
solved problem for several existing projects, and there is no virtue in re-deriving a
CodeMirror Live Preview implementation from first principles. There is, however, a real risk in
copying from them carelessly: a single GPL file pulled into an otherwise permissive codebase
relicenses the whole thing, and the mistake is usually discovered by somebody else.

So: **read the licence before the code.** This file records what was read, what it permits, and
what Campus actually decided.

## The rules applied

These four rules were applied to every project below. They are not negotiable per-project;
they are the gate.

| Upstream licence                               | What Campus may do                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Permissive** — MIT, BSD-2/3, ISC, Apache-2.0 | Reference, depend, copy, or port — **with provenance and a notice** in `THIRD_PARTY_NOTICES.md`. Apache-2.0 additionally requires retaining any `NOTICE` file and carries a patent grant/termination clause.                                                                                                                                                     |
| **Weak copyleft** — MPL-2.0, LGPL              | Depend on the unmodified artefact; do **not** copy source into Campus files. File-level copyleft means a copied file stays MPL forever. Case-by-case, default no.                                                                                                                                                                                                |
| **Strong copyleft** — **GPL, AGPL**            | **Reference only.** No copying, no porting, no linking. AGPL is worse than GPL for Campus specifically, because Campus is served over a network and AGPL §13 would reach the hosted deployment. This bar lifts _only_ if Campus's own licensing is explicitly changed and the obligations are consciously accepted — a product decision, not an engineering one. |
| **Proprietary**                                | **Reference only.** Study the published UX and documented architecture. Never the code, never decompiled artefacts, never leaked source.                                                                                                                                                                                                                         |
| **Unknown / unverified**                       | **Reference only**, until verified. An unverified licence is treated as no licence, which under copyright default means "all rights reserved".                                                                                                                                                                                                                   |

Two clarifications that keep coming up:

- **Ideas are not code.** Reading how SilverBullet derives an index from Markdown and then
  writing our own indexer is not a licence event. Copying `indexer.ts` is. Interface _shapes_
  (a five-method filesystem interface) sit near the ideas end; verbatim implementations do not.
- **"Reference only" is not a downgrade.** Most of the value in this research is architectural.
  The single most useful thing SilverBullet gave us — "the index is a cache, the Markdown is the
  truth" — costs nothing to adopt and carries no obligation.

---

## Primary study — SilverBullet

```yaml
project: SilverBullet
repo: https://github.com/silverbulletmd/silverbullet
license: MIT
commit_or_version: v2.10.0 @ 411a6c3ad28f43d4f1fd551e40e577d2f0dfb5b3 (2026-08-11)
studied_features:
  - Space (folder-of-Markdown) model
  - SpacePrimitives filesystem interface and its decorator chain
  - CodeMirror 6 editor composition and Live Preview
  - client/server boundary, service worker, HTTP file API
  - file-level bidirectional sync with conflict copies
  - derived object index (IndexedDB) and reindex model
  - wiki links, relations/backlinks, rename refactoring
  - commands, slash commands, and the completion pipeline
  - objects + SLIQ (Space Lua Integrated Query)
  - page templates and slash templates
  - PlugOS plug model and its Web Worker isolation boundary

allowed:
  reference: yes
  dependency: yes — `@silverbulletmd/silverbullet` v2.10.0 is published on npm (plug-api only)
  copy: yes — MIT permits it, with attribution; see caveat below
  port: yes — MIT permits it, with attribution

used_files: none — no SilverBullet code has been copied into Campus
notices: none required yet; a notice becomes mandatory the moment any file is copied or ported
decision: >
  REFERENCE now, PORT selectively later. SilverBullet is the closest existing thing to where
  Campus is heading and its licence imposes no constraint we care about. Campus will adopt its
  architectural decisions immediately (they are free) and may port narrow, well-bounded pieces
  later — the SpacePrimitives shape and specific Live Preview decorations are the realistic
  candidates. Campus will NOT depend on the npm package: it is the plug SDK for SilverBullet's
  own runtime, not a reusable library, and taking it would drag in 41 transitive dependencies
  plus a Lua interpreter Campus has no use for.
```

### Licence verification — the specific answer

**SilverBullet is MIT.** This was verified by reading `LICENSE.md` in a shallow clone of the
repository at commit `411a6c3ad28f43d4f1fd551e40e577d2f0dfb5b3`, not from GitHub's sidebar
detection. The file contains the verbatim MIT permission text under `Copyright 2022, Zef Hemel`,
with no "MIT License" title line — which is why an automated licence scanner might report it
ambiguously, and why it was read by hand. The Rust workspace corroborates it independently:
`Cargo.toml` sets `[workspace.package] license = "MIT"`.

**What that permits:** Campus may copy or port SilverBullet code into a permissively-licensed
product, including a commercial one, provided the copyright notice and permission text travel
with any substantial portion. There is no reciprocal obligation, no source-disclosure trigger,
and no network clause. **This is the answer the gate was waiting for: SilverBullet does not
block anything.**

**Two caveats worth recording:**

1. **Three files are Apache-2.0, not MIT.** `client/codemirror/hide_mark.ts`,
   `client/codemirror/list.ts` and `client/codemirror/util.ts` each carry a three-line header
   reading "Forked from https://codeberg.org/retronav/ixora", "Original author: Pranav
   Karawale", "License: Apache License 2.0". These are precisely the Live Preview files most
   worth porting.
   Porting them means honouring Apache-2.0 attribution (retain the header, add a `NOTICE`
   entry), not MIT attribution. Copying them while stripping the header would be a licence
   violation against ixora, not against SilverBullet.
2. **The npm package metadata omits a licence field.** `@silverbulletmd/silverbullet@2.10.0` on
   the registry has no `license` key. The repository `LICENSE.md` governs, and the ambiguity is
   cosmetic — but it is the kind of thing an automated compliance scan flags, so it is recorded.

### What SilverBullet actually is, at v2.10.0

Worth stating plainly, because most public writing about SilverBullet describes v1 and is now
wrong. v2 moved **all** application logic to the browser client (`docs/ADR/007`) and rewrote the
server three times — Deno → Go (2025) → **Rust** (2026, `docs/ADR/010`). The current shape is:
a TypeScript/Preact/CodeMirror client (352 files), a service worker holding the offline copy and
the sync engine, and a Rust Axum server (46 files) that does almost nothing but list, read,
write and delete files, plus auth. The client bundle is built with esbuild; Vite and Vitest are
used for tests and dev.

### Feature-by-feature

**Markdown "Space" architecture — what a Space concretely is.**
A Space is a **directory**. That is the whole definition, and SilverBullet says so explicitly:
"You may think of it as a Folder or a directory — because in practical terms, that's all it is."
It contains `.md` pages (page name = path minus the `.md`, so `Daily/2026-08-14.md` is the page
`Daily/2026-08-14`), attached documents, and two conventional pages: `index.md` (the space's
home) and `CONFIG.md` (configuration-as-a-page). There is no manifest, no `.silverbullet/`
sidecar, no database file in the folder. The stated consequence is the important part: you can
back the folder up, put it in git, or edit it in another editor, and SilverBullet will pick up
the change on its next sync poll. Everything structured — tags, tasks, links, attributes — is
_derived_ from the file contents, never stored beside them.
→ **REFERENCE.** Campus should adopt the "a workspace is just a folder, with an index page and
a config page as conventions" definition wholesale; there is no code to take.

**CodeMirror 6 integration.**
The editor is composed in one function, `createEditorState(client, pageName, text, readOnly,
selection)` in `client/codemirror/editor_state.ts`, which returns a single `EditorState.create({
doc, selection, extensions: [...] })`. The extension array is ordinary CM6 stock —
`@codemirror/lang-markdown`, `@codemirror/autocomplete`, `@codemirror/commands` (history),
`@codemirror/language` (`syntaxHighlighting`, `codeFolding`, `indentOnInput`), `@codemirror/view`
(`drawSelection`, `dropCursor`, `lineWrapping`, `domEventHandlers`), `@codemirror/lint` — plus
about twenty in-house extensions. The genuinely instructive detail is **`Compartment` discipline**:
five compartments are held on the client object (`commandKeyHandlerCompartment`,
`vimCompartment`, `indentUnitCompartment`, `undoHistoryCompartment`,
`markdownLanguageCompartment`) so that keybindings, the indent unit, undo history and even the
_Markdown language definition itself_ can be reconfigured live when plugs load or config
changes, without tearing down the editor. A second detail worth stealing: an
`Annotation.define<boolean>()` named `externalUpdate` tags transactions that came from storage
rather than the user, so the save-on-change `ViewPlugin` can skip them and avoid a save/reload
feedback loop. Vim mode is loaded lazily into an initially-empty compartment.
→ **DEPENDENCY** on the CodeMirror packages themselves; **REFERENCE** the compartment and
`externalUpdate` patterns, which are a handful of lines each and not worth a provenance entry.

**Live Preview.**
Not a separate render mode — it is a set of CM6 decorations layered on the live document, and
the docs credit Obsidian as the inspiration. `client/codemirror/clean.ts` assembles
`cleanModePlugins()`: about twenty `ViewPlugin`/`StateField` decorators (`hideMarksPlugin`,
`hideHeaderMarkPlugin`, `linkPlugin`, `taskListPlugin`, `tablePlugin`, `blockquotePlugin`,
`fencedCodePlugin`, `cleanWikiLinkPlugin`, `hashtagPlugin`, `frontmatterPlugin`, …). The core
trick is small and repeated everywhere: walk `syntaxTree(state)`, find nodes whose type is in a
`typesWithMarks` list (`Emphasis`, `StrongEmphasis`, `InlineCode`, `Highlight`, `Strikethrough`,
`Superscript`, `Subscript`), and if the cursor is **not** inside that node's range, apply an
`invisibleDecoration` over the child mark nodes. Move the cursor in and the syntax reappears.
Six plugins are marked as needed even when raw-syntax rendering is on (wiki links, hashtags,
attributes, frontmatter, Lua directives), which is a nice separation between "syntax sugar" and
"structural affordance". Alt-click reveals the source without navigating.
→ **PORT** is realistic and the highest-value code-level candidate in the whole study — but
remember `hide_mark.ts`/`list.ts`/`util.ts` are the Apache-2.0 ixora forks. Alternatively
**REFERENCE** the ~15-line cursor-in-range technique and write our own.

**Client/server boundary and transport.**
The server is deliberately dumb, and `docs/ADR/007` is an unusually honest account of why:
maintaining two plug runtimes (server-side and client-side) was the dominant maintenance cost,
so v2 deleted the server one. What remains is an HTTP file API under `/.fs`: `GET /.fs` returns
the full file listing with metadata, `GET /.fs/<path>` reads, `PUT` writes, `DELETE` deletes.
Metadata rides on custom response headers — `X-Last-Modified`, `X-Created`, `X-Permission`
(`rw`/`ro`), `X-Content-Length` — and every client request sets `X-Sync-Mode: true` so the
server can distinguish a sync fetch from a browser navigation. Beyond that there is only
`/.ping`, `/.shell`, `/.logs`, a CORS-dodging `/.proxy/<host>/path`, and auth (`/.auth`, JWT
cookie or `Authorization: Bearer`). The client's copy lives in IndexedDB; a service worker
intercepts the same HTTP API and serves it locally, so the application behaves identically
online and offline. There is a genuinely instructive piece of scar tissue in
`http_space_primitives.ts`: WebKit strips custom response headers when it recognises a file
extension in the URL, so the client percent-encodes the final dot as `%2E` and the server
decodes it.
→ **REFERENCE.** Campus's transport will not be HTTP-to-a-file-server; it will be the File
System Access API or a Tauri/Node host. But the _principle_ — "metadata as a listing, whole-file
read/write, the server never interprets content" — transfers directly.

**Sync.**
`client/spaces/sync.ts` implements the algorithm from Unterwaditzer's "sync algorithm" article
(cited in the source) over two `SpacePrimitives` instances, primary (local) and secondary
(remote). State is a `SyncSnapshot`: `Map<path, [localLastModified, remoteLastModified]>`.
Reconciliation is **whole-file** and driven purely by `lastModified` timestamps — no hashing, no
character-level diff. Concurrency is capped at 3. A full cycle runs about every 20 seconds, the
open file every 4–5. On a real conflict it does **not merge**: it writes a copy named
`<base>.conflicted:<timestamp>.<ext>`, lets the primary win, and flashes a notification. There
is a test asserting that identical content on both sides produces _no_ conflict copy, which is
the detail that makes the scheme livable. `docs/ADR/002` states plainly that CRDTs were tried
twice and removed both times for having too many edge cases, and that the Rust rewrite may
finally make them viable.
→ **REFERENCE**, strongly. If Campus ever syncs a local folder against Supabase, "whole-file,
timestamp-based, conflict-copy, never silently merge" is the correct starting point and the
ADR is the argument to cite. The code itself is coupled to `SpacePrimitives`.

**Filesystem abstraction — `SpacePrimitives`.**
This is the most valuable single artefact in the repository, and it is 26 lines:

```ts
export interface SpacePrimitives {
  fetchFileList(): Promise<FileMeta[]>
  getFileMeta(path: string, observing?: boolean): Promise<FileMeta>
  readFile(path: string): Promise<{ data: Uint8Array; meta: FileMeta }>
  writeFile(path: string, data: Uint8Array, meta?: FileMeta): Promise<FileMeta>
  deleteFile(path: string): Promise<void>
}
```

Five methods, `Uint8Array` rather than `string` (so images and PDFs need no second interface),
metadata returned from every write, and one pragmatic wart: `observing?: boolean` on
`getFileMeta`, a hint that a file is open so the sync engine can poll it harder. The real design
lesson is what surrounds it. Every implementation is either a **leaf** or a **decorator**:
`HttpSpacePrimitives` (remote), `DataStoreSpacePrimitives` (IndexedDB), then
`FilteredSpacePrimitives` (filter the listing), `CheckedSpacePrimitives` (validation),
`EventedSpacePrimitives` (emits `file:changed`, `file:deleted`, `file:listed`, `page:saved`,
tracking an in-flight operation count so batch syncs don't spam listeners). The client composes
them: `new EventedSpacePrimitives(new CheckedSpacePrimitives(...), eventHook, ds)`. Because
every layer implements the same five methods, sync, indexing, and the editor are all written
against one interface and never learn where bytes live. There is a shared
`space_primitives.test.ts` conformance suite, and the Rust side mirrors the same idea
(`server-common/src/space.rs` with `disk`, `http`, `memory`, `readonly`, `embed` backends and a
`conformance.rs`).
→ **PORT the interface shape** (it is small enough that "port" and "reference" nearly coincide,
but write down the provenance anyway), and **COPY the decorator-chain idea outright**. For
Campus this is what lets one codebase run over Supabase today, a File System Access API handle
tomorrow, and an in-memory fixture in tests — with the domain layer unchanged. Given
`docs/PRD.md` CAP-PLAN-002's insistence that logic lives in the domain and not in React, this
is the correct seam.

**Page indexing — derivation and rebuild.**
`docs/ADR/003` states the principle: **Markdown is the source of truth; the index is a cache
that can be flushed and rebuilt at any time** (`Space: Reindex`). Mechanically, a `file:changed`
event triggers a parse; `plugs/index/indexer.ts` runs an array of eleven independent
`IndexerFunction`s — `(pageMeta, frontmatter, tree, text) => Promise<ObjectValue[]>` — over the
same parse tree: page, data blocks, list items, headers, paragraphs, comments, relations,
tables, space-lua, space-style, tags. Results are flattened, post-processed to append `anchor`
records, and written via `index.indexObjects(name, objects)`. Storage is a KV store in IndexedDB
with a deliberately simple key namespace, documented in `plugs/index/api.ts`:

```
[indexKey, type, ...key, page] -> value      // the objects
[pageKey, page, ...key]        -> true       // fast per-page clearing
["type", type]                 -> true       // fast type listing
```

The second row is the trick worth stealing: re-indexing a page means deleting by the `page`
prefix and re-inserting, which makes incremental updates cheap and correct. A monotonic
`desiredIndexVersion` (currently 12) forces a full rebuild when the schema changes, and a
`$reindexInProgress` marker distinguishes a fresh install from an interrupted rebuild.
→ **REFERENCE** the model — cache-not-truth, an array of small pure indexers over one parse
tree, prefix-keyed per-page invalidation, a version integer that forces rebuilds. Campus should
implement this over SQLite rather than a KV store, so the code does not transfer; the shape does.

**Wiki links and backlinks.**
Parsing is a `MarkdownConfig` extension to `@lezer/markdown` (`client/markdown_parser/parser.ts`)
that defines `WikiLink`, `WikiLinkPage`, `WikiLinkAlias`, `WikiLinkDimensions` and `WikiLinkMark`
nodes and registers an inline parser `after: "Emphasis"`, with a cheap first-character check
(`[` or `!`) before the regex runs. `![[...]]` wraps the result in an `Image` node, which is how
transclusion falls out for free. Storage is the interesting evolution: as of a 2026 commit
("Introduce 'relation' indexer, demote 'link' to virtual view"), links are no longer a distinct
index type. Everything is a **`relation`** object — `{from, fromTag, to, toTag, kind, via, page,
range, alias, snippet}` — where `kind` is `mention`, `co-mention`, or a user-defined predicate
from frontmatter. A wiki link, a Markdown link, a frontmatter `dependsOn:` and an inferred
co-mention are all edges in one table, so backlinks ("Linked Mentions"), the graph view, and
semantic frontmatter queries are one query each. Links to non-existent pages emit
`aspiring-page` objects — unresolved links become first-class data rather than errors. Rename
(`plugs/index/refactor.ts`) queries `getTextualBackRelations`, and because each relation carries
a `range`, it splices the reference in the source text rather than regex-replacing the file;
`batchRenameFiles` handles multi-page renames and there is dedicated conflict/case-collision
handling for case-insensitive filesystems.
→ **PORT the data model** (one `relation` edge table, `kind` as a discriminator, unresolved
links as objects, ranges stored so rename is a splice) — this is the single best idea in the
repository after the index-is-a-cache principle. **REFERENCE** the lezer parser extension; if
Campus uses `@lezer/markdown` it will write a near-identical one, and 60 lines of parser is not
worth a provenance entry.

**Commands and slash commands.**
Two hooks over one registry. `CommandHook` builds a `Map<string, Command>` by layering:
directly-registered client commands first, then plug-manifest commands, then Space Lua script
commands, each layer patching the previous by name — so a user script can override a built-in
without forking it. Commands declare `name`, `key`/`mac` (arrays allowed), `priority`,
`requireMode: "rw" | "ro"`, `requireEditor`, `contexts`, `disableInVim`. Read-only mode filters
`rw` commands out of the keymap entirely rather than failing at invocation. The keymap is
rebuilt into a `Compartment` whenever the command set changes, throttled at 200ms.
`SlashCommandHook` is the same registry projected into a CM6 `autocompletion` source: it matches
`/([^\w:]|^)\/[\w#-]*/`, refuses to fire inside `CommentBlock` or `Link` nodes, and filters by
`onlyContexts`/`exceptContexts` — which are matched against **parent AST node names**, so
`/task` can be offered only inside a list item. On `apply`, it deletes the typed `/foo` via a
dispatch and then runs the command.
→ **PORT.** Campus's `Cmd/Ctrl+K` quick capture (`docs/design.md` §8) and `CAP-SEARCH-001`
want exactly this: one command registry, layered overrides, keymap in a compartment, and the
same registry projected as a slash-completion source. Context-filtering by AST parent node is
the detail that makes slash commands feel intelligent rather than noisy.

**Objects and the query language.**
Every indexed thing is an **object**: a row with a `ref` (globally unique — page name for pages,
`page@pos` for positional things, or the `$anchor` name if one is present), a `tag` (its type /
"table"), optional `tags` (explicit, via `#hashtag`), and `itags` (implicit/inherited, including
tags on the containing page). Attributes beyond those are open, optionally constrained by a
JSON-Schema-based `Schema`. Queries use **SLIQ** (Space Lua Integrated Query, `docs/ADR/006`), a
syntax that is a genuinely clever piece of language design: `query[[...]]` is _valid Lua_
(`[[...]]` is Lua's long-string literal and single-string calls may omit parens), so a
SQL/LINQ-flavoured `from / where / group by / having / order by / limit / offset / select`
dialect is embedded without forking the parser. Clauses may appear in any order; only `from` is
required; aggregates support intra-aggregate `order by` and `filter (where ...)`. It runs over
any Lua collection, not just the index. Notably, **full-text search is not in core** — it is a
third-party library (`silversearch`), because structured queries cover most of what users
actually want.
→ **REFERENCE the object model** (`ref`/`tag`/`tags`/`itags`, everything is a row, tags are
tables). **Reject the query language.** SLIQ is beautiful and completely wrong for Campus:
it requires shipping a Lua interpreter, and `docs/PRD.md` §16 already rules out end-user
programming. Campus's equivalent is typed domain queries over SQLite. The `itags` inheritance
idea, though — a task inheriting its page's tags — is directly useful for "every deadline on a
subject page belongs to that subject".

**Templates.**
Templates are just pages, tagged in frontmatter. A **page template** (`#meta/template/page`)
carries frontmatter keys `suggestedName` (with `${date.today()}` interpolation), `confirmName`,
`openIfExists`, `command`, `key`/`mac`, `frontmatter`, `priority`, and uses `|^|` in the body to
mark the post-creation cursor position. A **slash template** (`#meta/template/slash`) is the same
idea bound to a slash command, with the command name taken from the last path segment
(`Library/Slash Template/action-items` → `/action-items`). Both are discovered by _querying the
index for pages with that tag_, which means the extension mechanism and the content mechanism
are the same mechanism — a template ships as a Markdown file in the space, no registration step.
`priority` resolves collisions so a user template can shadow a library one.
→ **PORT the idea**, cheaply. "A template is a Markdown file with frontmatter, discovered by
querying the index, with `|^|` marking the cursor" is a complete and very small design. Campus
would use it for recurring academic items (weekly TP, exam prep page) without building a
template subsystem.

**The plug/extension model and its isolation boundary.**
A **plug** is a `.plug.js` bundle compiled by esbuild from a `<name>.plug.yaml` manifest that
maps exported functions to hooks: `functions: { indexPage: { path: "indexer.ts:indexPage",
events: ["page:index"] } }`, or `command:`, `slashCommand:`, `syscall:`, `mqSubscriptions:`,
`pageNamespace:`. The isolation boundary is a **Web Worker**: `WorkerSandbox` implements a
four-method `Sandbox` interface (`init`, `invoke`, `stop`, `manifest`), spawns
`new Worker(url, { type: "module" })`, and communicates over `postMessage` with a small protocol
(`{type: "sys", name, args}` out, `{type: "sysr", ...}` back) and a 5-second boot timeout. Plug
code has **no DOM, no direct storage, and no network** — every capability arrives as a
**syscall** it must request by name (`editor.*`, `space.*`, `index.*`, `system.*`, `mq.*`,
`fetch.*`, `shell.*`), and the host mediates every one. That is the whole security model, and it
is a good one: capability-by-syscall rather than trust-by-review. Syscalls carry
self-documenting metadata in the manifest (parameters, types, return, `see:` link), so the API
docs are generated from the same YAML that wires the function up. A second, lighter extension
tier — Space Lua — runs _in_ the client without a worker, for user scripting.
→ **REFERENCE.** Campus has no plugin story and `docs/PRD.md` §16 gives it no room for one. But
two ideas cost nothing and should be adopted now: **capability-by-syscall** (features request
narrow, named host functions rather than reaching for storage directly) and **manifest-declared
capabilities** — both are just good hexagonal-architecture hygiene under different names. Revisit
the Worker sandbox only if Campus ever runs untrusted code, which it should try hard not to.

---

## Secondary study

Briefer, architecture and UX only. Same gate applies.

**The headline result, stated once so it is not buried:** every project in this section is
either copyleft or proprietary. Obsidian is closed-source; Zettlr is GPL-3.0; Logseq, Trilium,
Joplin, AppFlowy and SiYuan are all AGPL-3.0. **SilverBullet is the only permissively-licensed
project in this entire study.** That is not an inconvenience — it is the reason the primary
study went where it did. Everything below is read-and-learn.

### Obsidian

```yaml
project: Obsidian
repo: https://obsidian.md (application is closed-source; no source repository exists)
license: proprietary — app closed-source; `obsidianmd/obsidian-api` typings are MIT (Copyright 2022 Dynalist Inc.)
commit_or_version: obsidian-api @ cc1744324150c632416857c98964f87b1574a5fc (v1.13.2 via npm; repo has no tags or releases)
studied_features:
  - vault model (plain directory + `.obsidian/` config folder)
  - Vault API surface, especially `cachedRead` and `process(file, fn)`
  - MetadataCache — `resolvedLinks` / `unresolvedLinks`
  - CachedMetadata positional per-file structure and `ListItemCache.task`
  - Dataview → first-party "Bases" query surface
  - plugin API shape (Component lifecycle + `register*`)

allowed:
  reference: yes
  dependency: no — nothing to depend on; the app is not distributed as a library
  copy: no — proprietary. The MIT-licensed `.d.ts` typings are technically copyable, but they describe Obsidian's API and would only make sense if Campus wanted API compatibility, which it does not.
  port: no

used_files: none
notices: none
decision: >
  REFERENCE ONLY, and firmly so — the app is proprietary, and the studied material is
  documentation, published typings, and observed behaviour. Two ideas are worth adopting on
  their own merits, not because Obsidian had them: the `resolvedLinks` / `unresolvedLinks`
  split (unresolved links are data, not errors — the same conclusion SilverBullet reaches with
  `aspiring-page`), and a positional metadata cache so features render from the cache and never
  re-parse.
```

The vault is a directory of Markdown plus a `.obsidian/` config folder, which is the same
definition SilverBullet arrives at from a different direction — strong evidence it is simply the
right one. `MetadataCache` exposes two flat maps of shape
`Record<sourcePath, Record<targetPath, occurrenceCount>>`, one resolved and one unresolved, and
per-file `CachedMetadata` carrying `links`, `embeds`, `tags`, `headings`, `sections`,
`listItems`, `frontmatter` (+ `frontmatterPosition`, `frontmatterLinks`), `blocks` and
`footnotes` — all with `Pos` ranges. `ListItemCache` models a task with a single character
(`' '` = incomplete, anything else = done) plus a `parent` line-number pointer for hierarchy;
that is a strikingly cheap task model and Campus's `AcademicItem` extraction from Markdown could
start there. Two API details are worth copying as _behaviour_: `cachedRead` (reads that don't
hit disk when the cache is warm) and `process(file, fn)` (read-modify-write without a race),
plus the separation that renames go through `FileManager`, not `Vault`, because link rewriting
is a distinct concern. Dataview, historically a community plugin built on
`registerMarkdownCodeBlockProcessor`, has been absorbed as first-party **Bases** with a typed
value hierarchy and declarative filters — the trajectory is a useful data point, but Campus has
ruled out user-facing query languages (`docs/PRD.md` §16).

### Logseq

```yaml
project: Logseq
repo: https://github.com/logseq/logseq
license: AGPL-3.0
commit_or_version: v2.0.1 (2026-07-13); master @ abdc94bfb47c (2026-08-13)
studied_features:
  - DataScript triple store + explicitly versioned index schema
  - SQLite persistence (sqlite-wasm in browser, better-sqlite3 on Electron)
  - db-sync checksummed operation log
  - outliner/block-first editing model

allowed:
  reference: yes
  dependency: no
  copy: no — AGPL-3.0
  port: no — AGPL-3.0

used_files: none
notices: none
decision: >
  REFERENCE ONLY (AGPL). The most useful lesson is a negative one: Logseq 2.0 abandoned
  "files are the database" for a DataScript triple store persisted as serialized datoms in
  SQLite, demoting the Markdown parser to an import/export path. That is the exact trade
  Campus must not make — it is how a local-first Markdown tool stops being one. The positive
  lessons are the explicitly versioned index schema (currently 65.33, with major/minor
  compatibility comparison) and sync as a checksummed operation log rather than file diffing.
  The bespoke block-level editor is the part to avoid outright.
```

Licence verified from `LICENSE.md` on `master`; the root `package.json` declares no `license`
field, so the file is the only source of truth. Note the schema-versioning pattern generalises
well beyond Logseq and echoes SilverBullet's `desiredIndexVersion` integer: a derived index must
carry a version that can force a rebuild, or the first schema change becomes a support incident.

### Trilium (TriliumNext)

```yaml
project: Trilium (TriliumNext)
repo: https://github.com/TriliumNext/Trilium # zadam/trilium was transferred here, not forked — same repo id, 301 redirect
license: AGPL-3.0-only # LICENSE file and package.json agree
commit_or_version: v0.104.1 (2026-07-25); main @ 9652334f403f (2026-08-13)
studied_features:
  - becca — full note tree cached in memory, loaded from SQLite at boot
  - five first-class entities (note, branch, attribute, blob, revision/attachment)
  - content-addressed deduplicated blob storage
  - lex → parse → expression-tree search pipeline
  - sector-bucketed content hashing for sync divergence detection

allowed:
  reference: yes
  dependency: no
  copy: no — AGPL-3.0-only
  port: no — AGPL-3.0-only

used_files: none
notices: none
decision: >
  REFERENCE ONLY (AGPL). The genuinely valuable idea is the search architecture: a hand-written
  lex → parse → typed expression tree (`and`, `or`, `not`, `ancestor`, `descendant_of`,
  `label_comparison`, `note_content_fulltext`, `relation_where`, `order_by_and_limit`)
  evaluated against an in-memory index. That is the shape Campus's typed domain queries should
  take — composable expression nodes, not string concatenation — and it is a much better fit
  than SilverBullet's SLIQ because it needs no scripting language. The Branch-as-separate-entity
  model (a note's placement in the tree is not the note) is also worth noting for a future where
  a subject appears under more than one plan version.
```

### Joplin

```yaml
project: Joplin
repo: https://github.com/laurent22/joplin
license: AGPL-3.0-or-later — WITH a proprietary carve-out; `packages/server/` is under the "Joplin Server Personal Use License" (non-free). Root package.json has no license field; GitHub reports NOASSERTION.
commit_or_version: v3.6.15 (2026-06-20); dev @ 6233b510ff2b
studied_features:
  - plain-text serialization format (title / body / trailing `key: value` metadata)
  - SQLite + FTS4 external-content tables maintained by triggers, BM25 ranking
  - FileApi sync-target driver interface with ~10 interchangeable backends
  - lock handler, migration handler, E2EE, conflict-note materialization
  - CodeMirror 6 editor package

allowed:
  reference: yes
  dependency: no
  copy: no — AGPL-3.0-or-later, and `packages/server/` is worse than AGPL: proprietary
  port: no

used_files: none
notices: none
decision: >
  REFERENCE ONLY (AGPL + a proprietary subdirectory — this is the single most licence-hazardous
  repository in the study, because the carve-out is invisible from the root LICENSE). The
  transferable idea is the `FileApi` driver interface: one narrow interface with ten
  interchangeable sync targets (local FS, WebDAV, S3, Dropbox, OneDrive, Joplin Server),
  registered through a `SyncTargetRegistry`, with lock and migration handling factored out —
  the same insight as SilverBullet's `SpacePrimitives`, reached independently, which is strong
  corroboration that Campus should build that seam. Also worth noting: FTS maintained by
  database triggers on an external-content table, so the search index cannot drift from the
  rows it indexes.
```

### AppFlowy

```yaml
project: AppFlowy
repo: https://github.com/AppFlowy-IO/AppFlowy
license: AGPL-3.0
commit_or_version: v0.13.2 (2026-08-11); main @ 5cf3a365dec0d59f64bad1ee4bb1050471a39b93
studied_features:
  - Flutter shell over a Rust core, split into vertical feature crates
  - typed event dispatch across the FFI boundary (lib-dispatch)
  - Yrs/Yjs CRDT documents persisted as encoded updates in SQLite
  - flowy-sqlite-vec — semantic search in the same SQLite file

allowed:
  reference: yes
  dependency: no
  copy: no — AGPL-3.0
  port: no — AGPL-3.0

used_files: none
notices: none
decision: >
  REFERENCE ONLY (AGPL), and mostly as a counter-example. AppFlowy is not a Markdown app:
  documents are CRDTs persisted as encoded Yjs updates, so there is no file a student could
  open in another editor. That is the opposite of where Campus is going. Two things do
  transfer: the vertical feature-crate split with a typed event boundary (a headless,
  renderer-independent core — the same instinct as `docs/PRD.md` CAP-PLAN-002 keeping domain
  logic out of React), and keeping auxiliary indexes in the same SQLite file rather than
  standing up a second datastore.
```

### SiYuan

```yaml
project: SiYuan
repo: https://github.com/siyuan-note/siyuan
license: AGPL-3.0 # app/package.json declares no license field; repo LICENSE governs
commit_or_version: v3.8.0 (2026-08-12); master @ 251596fc0de2f9528c00c224252fd073a99973f4
studied_features:
  - block-addressed storage — `.sy` JSON (Lute AST) as source of truth, Markdown only as import/export
  - stable block IDs + inline attribute lists (IAL) enabling block refs and transclusion
  - derived SQLite index (blocks, spans, refs, attributes, assets) with FTS5 external-content table
  - async index queue instead of synchronous indexing on save
  - dejavu — content-addressed, encrypted, Git-like snapshot sync
  - out-of-process plugin sandbox over websocket RPC

allowed:
  reference: yes
  dependency: no
  copy: no — AGPL-3.0
  port: no — AGPL-3.0

used_files: none
notices: none
decision: >
  REFERENCE ONLY (AGPL). The indexing design is the most directly transferable thing in the
  secondary study: a disposable SQLite index with an **FTS5 external-content table**
  (`content='blocks', content_rowid='rowid'`) so the inverted index stores no duplicate column
  values, fed by an **async index queue** rather than indexing synchronously on save, with
  backlinks as a plain `SELECT ... FROM refs WHERE def_block_id = ?` rather than a graph
  traversal. Campus should adopt all three. What Campus should reject is the storage format:
  `.sy` JSON as the source of truth means the student's folder is not readable Markdown, which
  fails the premise.
```

### Zettlr

```yaml
project: Zettlr
repo: https://github.com/Zettlr/Zettlr
license: GPL-3.0 # LICENSE on master and develop; package.json on develop declares "GPL-3.0"
commit_or_version: v4.7.0 (2026-07-26); develop @ c855dcebc014f1a326a9be3cd35af7516fcb2c29
studied_features:
  - Electron + Vue 3 + Pinia over plain Markdown files, no database
  - ~22 service providers behind a ProviderContract (boot/shutdown + one IPC channel each)
  - FSAL — file system abstraction layer producing MDFileDescriptor objects
  - fsal-cache — sharded on-disk descriptor cache for cold start
  - LinkProvider — outbound map inverted to produce backlinks
  - CodeMirror 6 with a custom extension set, plus a separate non-editor markdown AST

allowed:
  reference: yes
  dependency: no
  copy: no — GPL-3.0
  port: no — GPL-3.0

used_files: none
notices: none
decision: >
  REFERENCE ONLY (GPL-3.0), and it is the closest architectural analogue to Campus's
  destination: CodeMirror 6 over plain Markdown files on disk with no database at all. Three
  things to take as ideas. First, the **service-provider contract** — every subsystem
  implements `boot()`/`shutdown()` and owns exactly one IPC channel, which is the same
  ports-and-adapters discipline Campus already wants. Second, the **sharded on-disk descriptor
  cache** (~100 shard files; their own comment claims a 25–90% boot-time improvement on ~6,000
  files) — a cheap answer to the cold-start indexing cost that SilverBullet's ADR/007 lists as
  its main regression. Third, the **split between the editor's parse and a separate
  non-editor markdown AST** — which is a real fork in the road, and Campus should go the other
  way (see the recommendation section: one grammar, shared by editor and indexer). Zettlr's
  own `LinkProvider` source carries honest TODOs about full reindex on every workspace event
  and no duplicate-ID detection; worth reading as a warning about invalidation granularity.
```

---

## What Campus should actually do

The temptation after research like this is to conclude "port SilverBullet". Don't. SilverBullet
is a general-purpose programmable knowledge system with a Lua runtime, a plug sandbox, a service
worker sync engine and a Rust server; Campus is an academic tracker that wants to grow a
Markdown surface. Taking its architecture wholesale would import its complexity budget without
its user base.

What follows is the concrete build-vs-buy line.

### Take as dependencies

**CodeMirror 6 — all MIT.** There is no serious alternative for a Markdown editor with Live
Preview, and every package is MIT with no attribution burden beyond a notices entry.

| Package                              | Version at review | Licence | Why                                                                                 |
| ------------------------------------ | ----------------- | ------- | ----------------------------------------------------------------------------------- |
| `@codemirror/state`                  | 6.7.1             | MIT     | `EditorState`, `Compartment`, `Annotation`, transactions                            |
| `@codemirror/view`                   | 6.43.8            | MIT     | `EditorView`, decorations, `ViewPlugin`, DOM event handlers                         |
| `@codemirror/language`               | 6.12.4            | MIT     | `syntaxTree`, `syntaxHighlighting`, folding, `indentOnInput`                        |
| `@codemirror/lang-markdown`          | 6.5.2             | MIT     | the Markdown language, `deleteMarkupBackward`                                       |
| `@codemirror/commands`               | 6.10.4            | MIT     | history/undo, standard editing commands                                             |
| `@codemirror/autocomplete`           | 6.20.3            | MIT     | the completion source that slash commands and `[[` linking both plug into           |
| `@codemirror/search`                 | 6.7.1             | MIT     | in-document search — add when needed, not on day one                                |
| `@lezer/markdown`                    | 1.7.2             | MIT     | **required** to add `[[wiki link]]` syntax; the extension point is `MarkdownConfig` |
| `@lezer/common` / `@lezer/highlight` | 1.5.2 / 1.2.3     | MIT     | tree walking and `styleTags` for custom node styling                                |

`@codemirror/lint` (MIT) only if Campus surfaces in-editor diagnostics — e.g. "this deadline has
no date". Not for the first pass.

**Parsing outside the editor.** CodeMirror's Lezer tree is the right parse _inside_ the editor,
but indexing a whole folder should not spin up an editor. Two honest options:

- **`@lezer/markdown` on its own** (MIT). This is what SilverBullet does: the exact same parser,
  same extensions, same tree, running headless. **Recommended** — one grammar, one wiki-link
  extension, one set of node names shared by the editor and the indexer. The alternative
  guarantees a class of bug where the editor and the index disagree about what a link is.
- **`unified` + `remark-parse` + `mdast-util-from-markdown`** (all MIT). A richer plugin
  ecosystem and a nicer AST, but a _second_ grammar with different node names, and wiki links
  need a `micromark` extension written separately from the CodeMirror one. Choose this only if
  Campus needs remark's transform ecosystem, which it currently does not.

**Frontmatter and YAML.** `yaml` (**ISC**, v2.9.0) over `js-yaml` (MIT). ISC is functionally MIT.
`yaml` preserves comments and formatting on round-trip via its Document API, which matters the
moment Campus writes back to a student's file — silently reformatting somebody's notes is the
fastest way to lose their trust. Do **not** take `gray-matter` (MIT): it is a thin
split-on-`---` wrapper with a stale dependency tail, and the split is ten lines we should own.

**Index storage — SQLite, one of two shapes.**

- Browser/PWA: **`@sqlite.org/sqlite-wasm`** (**Apache-2.0**, official SQLite build, OPFS-backed
  and persistent) or **`sql.js`** (MIT, mature, but in-memory with manual persistence).
  Apache-2.0 is fine — it is already Campus's situation with `class-variance-authority` — it just
  needs a notices entry. Note that SQLite's own code is public domain; the Apache-2.0 applies to
  the wasm packaging.
- Node/Tauri desktop: **`better-sqlite3`** (MIT, v13). Synchronous, fast, and the right call for
  an indexer that runs off the UI thread.

Use **FTS5**, which is built into both, for search — specifically as an **external-content
table** (`content='notes', content_rowid='rowid'`), which is what SiYuan does and what Joplin
does with FTS4, so the inverted index stores no duplicated column values. Joplin additionally
maintains it with `BEFORE UPDATE`/`DELETE` triggers, which means the search index structurally
cannot drift from the rows it indexes; that is worth copying as a technique. Do **not** add
`minisearch` (MIT) or `flexsearch` (Apache-2.0): a second search index over data that is already
in SQLite is a synchronisation bug waiting to happen. `fuse.js` (Apache-2.0) is fine for the
_command palette_ only — fuzzy-matching a few hundred command and subject names in memory,
which is a different problem from full-text search over notes.

**File watching.** `chokidar` (MIT, v5) if and only if Campus gains a Node or Tauri host. In the
browser there is nothing to install: the File System Access API has no change notification, so
Campus must poll `getFile().lastModified` — which is exactly what SilverBullet's sync engine
does over HTTP, and its 20s-full / 5s-open-file cadence is a well-tested starting point.

**Already in `package.json` and correct.** `date-fns` (MIT) for academic date arithmetic;
`@supabase/supabase-js` (MIT); TanStack Router/Query (MIT); `clsx` + `tailwind-merge` (MIT);
`lucide-react` (ISC); `class-variance-authority` (Apache-2.0 — the one entry that genuinely
requires the notice).

**Consider:** `zod` (MIT) for validating frontmatter that a student typed by hand. Frontmatter is
untrusted input; today Campus validates at the Supabase boundary, and a Markdown boundary will
need the same discipline.

### Do NOT take as dependencies

- **`@silverbulletmd/silverbullet`** (npm, v2.10.0). MIT, so permitted — but it is the plug SDK
  for SilverBullet's own runtime, with 41 dependencies including a Lua interpreter. Read the
  source, do not install it.
- **Any Lua runtime.** SLIQ is elegant and `docs/PRD.md` §16 rules out end-user programming.
- **A general plugin system.** No plugin API until there is a second party who wants one.
- **A CRDT library** (Yjs, Automerge — both permissive). SilverBullet tried twice and reverted
  twice (`docs/ADR/002`). Campus is single-player by principle (P-06). Whole-file, timestamp-based
  reconciliation with conflict copies is the right amount of machinery.
- **A second full-text search engine.** See above.

### Write ourselves

- **The wiki-link `MarkdownConfig` extension** (~60 lines against `@lezer/markdown`). Small,
  and Campus's link semantics — `[[Análisis Matemático II]]` resolving to a _subject_, not just a
  page — differ from SilverBullet's from the first line.
- **The `SpacePrimitives`-equivalent port and its adapters.** Five methods. Campus writes
  `SupabaseSpace`, `FileSystemAccessSpace`, and `MemorySpace` behind one interface, plus a shared
  conformance test suite. This is the highest-leverage single decision in the whole document, and
  it is the seam that lets the Supabase POC and the local-first future coexist.
- **The indexer and the domain schema.** Campus's objects are `Subject`, `AcademicItem`,
  `Resource`, `Prerequisite` — not generic pages. A typed SQLite schema beats a generic object
  store here, and `docs/PRD.md` CAP-PLAN-002 requires that prerequisite recalculation live in the
  domain layer anyway.
- **The relation/backlink table.** Ported _shape_ (one edge table, `kind` discriminator, ranges
  stored for splice-based rename, unresolved links as first-class rows), our own code.
- **The command registry and quick capture.** Layered `Map<string, Command>` + a compartmentised
  keymap + the same registry projected as a CM6 completion source. Maybe 200 lines, and
  `docs/design.md` §8 already specifies the UX.
- **Live Preview decorations.** Start by referencing the cursor-in-range technique and writing
  our own for the handful of node types Campus actually needs. Port the ixora-derived files only
  if we end up wanting the full set — and then honour Apache-2.0.

### Patterns to adopt that cost nothing and carry no licence weight

Six projects independently converged on these. They are architecture, not code, so no notice is
owed for any of them:

1. **The index is a cache; the Markdown is the truth.** Flushable, rebuildable, versioned with a
   monotonic integer that forces a rebuild on schema change (SilverBullet `desiredIndexVersion`,
   Logseq's `65.33` with major/minor compatibility comparison).
2. **One narrow filesystem interface with swappable implementations.** SilverBullet's
   `SpacePrimitives` (5 methods), Joplin's `FileApi` (~10 drivers), Zettlr's FSAL — three
   projects, same conclusion. Build it before the second storage backend exists, not after.
3. **Index asynchronously through a queue**, not synchronously on save (SiYuan). The editor
   should never wait on the indexer.
4. **Backlinks are a table query, not a graph walk.** `SELECT ... FROM relations WHERE to = ?`.
   Store the source `range` on each edge so rename becomes a splice rather than a regex replace.
5. **Unresolved links are data.** SilverBullet's `aspiring-page`, Obsidian's `unresolvedLinks` —
   a link to a subject page that does not exist yet is a feature ("create it"), not an error.
6. **Cache descriptors on disk for cold start** (Zettlr's sharded `fsal-cache`). The per-client
   cold-start reindex is the one regression SilverBullet's `docs/ADR/007` admits to; a
   descriptor cache is the cheap mitigation.

And one that is worth stating as a rejection: **do not let the database become the source of
truth.** Logseq crossed that line in 2.0 and SiYuan was always on the other side of it. Both are
defensible products; neither is what Campus is trying to be.

### Provenance discipline, in one paragraph

When anything is copied or ported: keep the upstream copyright header in the file, add a comment
at the top naming the upstream URL, commit/tag and licence, add a row to
`THIRD_PARTY_NOTICES.md` §2, and update the `used_files:` and `notices:` keys in this document's
YAML block for that project. Three steps, done at copy time, in the same commit. Provenance
reconstructed six months later is guesswork with a citation format.
