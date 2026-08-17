# Workspace references — studied interactions

**Status:** research record for the Campus workspace (rail → explorer → panes).
**License authority:** `docs/research/open-source-reuse.md` is the gate. This file records
_what to study_, that one records _what may be copied_. Where they disagree, the gate wins.
License verdicts below restate the gate as of 2026-08-14; SilverBullet was hand-verified at
pin `411a6c3` (v2.10.0). Others are behavior-study references and were not re-verified here.

Every entry names concrete interactions. If a row cannot name one, it does not belong here.

---

## Obsidian

- **URL:** https://obsidian.md
- **License:** Proprietary. **Behavior study only** — published UX and documented plugin API
  surface. Never code, never decompiled artifacts.
- **Worth studying:**
  1. **Quick switcher ranks recently-opened files above fuzzy title matches**, so `Ctrl+O`
     usually needs zero characters typed — recency is the real query. Campus should rank
     recent notes and today's daily note first.
  2. **Backlink pane shows collapsible per-source context snippets** (the surrounding
     paragraph, not just the filename), plus a separate "unlinked mentions" section that
     offers one-click linking. The snippet is what makes backlinks useful for study notes.
  3. **Live Preview reveals raw Markdown syntax only on the active line**; everywhere else
     marks are hidden and widgets rendered. The cursor is the mode switch — no preview pane.
  4. **Hover a `[[wikilink]]` with a modifier → popover preview of the target note.** Cheap
     to build over our index, high value when checking a correlativa or a definition.
- **Do NOT copy:** graph view as a hero feature (pretty, rarely useful for coursework);
  the plugin-settings sprawl; vault-wide modal settings as the only configuration surface.

## SilverBullet

- **URL:** https://github.com/silverbulletmd/silverbullet
- **License:** MIT at pin `411a6c3ad28f43d4f1fd551e40e577d2f0dfb5b3` (v2.10.0). **The only
  project safe for source-level study and selective porting**, with attribution in
  `THIRD_PARTY_NOTICES.md`. Three files are Apache-2.0 — check per-file before porting.
- **Worth studying (source-level):**
  1. **Live Preview as CM6 decorations:** marks are replaced by widgets/`Decoration.replace`,
     and a node re-expands to raw syntax when the selection touches its range. This is the
     reference implementation for our editor.
  2. **`SpacePrimitives` — a small filesystem interface with a decorator chain** (readonly,
     eventing, fallback). The shape maps directly onto our vault adapter over the File System
     Access API.
  3. **The index is a cache, Markdown is the truth:** derived object index in IndexedDB,
     rebuildable at any time. Identical to our `index.sqlite` invariant — steal the reindex
     lifecycle, not just the slogan.
  4. **Completion pipeline:** `[[` triggers page completion, `/` triggers slash commands,
     both as ordinary `@codemirror/autocomplete` sources over the index.
- **Do NOT copy:** the npm package as a dependency (it is the plug SDK for their runtime —
  41 transitive deps and a Lua interpreter); PlugOS worker architecture (we have no plugin
  system to justify it); server/service-worker split (Campus is local-first, not self-hosted).

## Zettlr

- **URL:** https://github.com/Zettlr/Zettlr
- **License:** GPL-3.0. **Behavior study only.** No copying, no porting.
- **Worth studying:**
  1. **Combined file manager:** one sidebar toggles between tree and flat "expanded" list of
     the active directory — good for a Materias tree that is shallow but wide.
  2. **Citation autocomplete** (`@key` against a CSL/Zotero library) rendered as a formatted
     citation inline — the pattern for academic references even if we defer the feature.
  3. **Table-of-contents sidebar generated from headings** with click-to-scroll; the right
     shape for long lecture notes.
- **Do NOT copy:** the dense toolbar (contradicts our quiet chrome); the three-way
  preferences dialog; GPL source, ever.

## Logseq

- **URL:** https://github.com/logseq/logseq
- **License:** AGPL-3.0. **Behavior study only.**
- **Worth studying:**
  1. **Journal-first home:** an infinite scroll of daily pages, newest first, so capture has
     zero filing cost. Maps onto our `Daily/` + Inbox capture flow.
  2. **Right "shelf" sidebar** that accumulates pinned blocks/pages during a session — a
     working-memory surface while writing, distinct from navigation.
  3. **Block references with live embed** (`((id))` renders the referenced block inline,
     edits propagate) — study the UX, not the outliner data model behind it.
- **Do NOT copy:** forcing every note into outliner bullets (Campus notes are prose
  documents); storing app state inside the Markdown as block properties.

## Joplin

- **URL:** https://github.com/laurent22/joplin
- **License:** AGPL-3.0 (relicensed from MIT). **Behavior study only.**
- **Worth studying:**
  1. **Conflict handling that never picks a winner:** sync conflicts become copies in a
     visible "Conflicts" notebook. Matches our vault-format rule — keep both, surface it.
  2. **Note history/revisions** kept locally with a retention window — the shape for
     `.campus/trash/` plus a future per-note history.
  3. **External-editor watch:** edit a note in any editor, Joplin detects the change and
     reloads. Campus must treat external edits as normal, exactly like this.
- **Do NOT copy:** the split source/rendered-preview as the primary editing mode (we commit
  to Live Preview); the plugin-heavy settings tree.

## VS Code (panes / tabs / palette model)

- **URL:** https://github.com/microsoft/vscode
- **License:** Source is MIT (the branded binary is proprietary). MIT permits source study
  and porting with notice, but its Electron-scale abstractions rarely port cleanly — treat
  as an interaction reference first.
- **Worth studying:**
  1. **Preview tabs:** single-click opens an italic, reusable tab that is replaced by the
     next single-click; double-click or an edit pins it. Solves tab explosion while browsing
     a Materia's notes.
  2. **Editor groups:** drag a tab to a pane edge → split; groups are the layout primitive,
     tabs live inside groups. This is our pane-group model.
  3. **One palette, prefix-switched:** `Ctrl+P` = files (fuzzy + MRU), typing `>` = commands,
     `@` = symbols. One input, several ranked domains.
  4. **Status bar as a passive strip:** left = context (branch ≈ our vault/materia), right =
     mode indicators; click-to-act, never demands attention.
- **Do NOT copy:** activity-bar icon overload; the settings-UI labyrinth; notification
  toasts stacking in the corner.

## Linear (command palette ergonomics)

- **URL:** https://linear.app
- **License:** Proprietary web app. **Behavior study only.**
- **Worth studying:**
  1. **Context-ranked palette:** with an issue selected, `Cmd+K` puts that issue's actions
     first — the palette reads the current selection. Ours should rank actions for the
     focused note/materia first.
  2. **Every palette row shows its keyboard shortcut inline**, so the palette teaches the
     shortcuts that make it unnecessary.
  3. **Typed sub-flows:** "Assign to…" re-prompts inside the same palette instead of opening
     a dialog. One surface for multi-step actions ("Move note to… → Materia").
- **Do NOT copy:** the dark, glossy, gradient marketing aesthetic — the opposite of our
  paper direction.

## Bear / Craft (editorial typography)

- **URLs:** https://bear.app · https://www.craft.do
- **License:** Both proprietary. **Behavior study only.**
- **Worth studying:**
  1. **Bear: Markdown marks stay visible but faded** — `#`, `*`, `[[` render in a muted ink
     so the document reads as typography while staying honest plain text. A calmer
     alternative to full mark-hiding; consider it for headings.
  2. **Bear: `#tags` styled inline as quiet lozenges** where they were typed — metadata
     lives in the text, not in a separate panel.
  3. **Craft: strong serif display headings over quiet sans body** — the exact contrast our
     Newsreader/Inter pairing is for.
- **Do NOT copy:** Craft's glossy block cards, drop shadows, and drag-handles-everywhere;
  Bear's single-notebook model (Campus is folder-first).

## iA Writer (focus / readable measure)

- **URL:** https://ia.net/writer
- **License:** Proprietary. **Behavior study only.**
- **Worth studying:**
  1. **Fixed readable measure, always centered** (~65ch) regardless of window width; the
     window grows, the text column does not. Our editor measure rule comes from here.
  2. **Focus mode dims everything but the current sentence/paragraph** — an optional state,
     off by default, worth having for exam-prep writing sessions.
  3. **Syntax control without a preview pane:** formatting is visible in-place; the file is
     always the plain text. Reinforces the Live Preview commitment.
- **Do NOT copy:** hiding all chrome all the time — Campus must keep academic context
  (deadlines, subject, correlativas) reachable while writing.

---

## CodeMirror 6 as the editor engine

All packages below are MIT and already installed (see `package.json`).

| Package                     | Version | What it covers for Campus                                                                                                                         |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codemirror`                | ^6.0.2  | Meta-package: `basicSetup` bundle. Useful for bootstrapping; we will replace it with an explicit extension list once the editor stabilizes.       |
| `@codemirror/lang-markdown` | ^6.5.2  | Lezer-based Markdown + GFM parsing; the syntax tree that Live Preview decorations walk. Accepts `codeLanguages` for fenced blocks.                |
| `@codemirror/language-data` | ^6.5.2  | Lazy-loaded language descriptions so a ` ```python ` block highlights without shipping every grammar upfront.                                     |
| `@codemirror/view`          | ^6.43.8 | `EditorView`, decorations, widgets, view plugins — the entire Live Preview mechanism (replace marks with widgets, re-expand under the selection). |
| `@codemirror/state`         | ^6.7.1  | Transactions, `StateField`, facets — where frontmatter state, wikilink index lookups, and decoration sets live.                                   |
| `@codemirror/commands`      | ^6.10.4 | Default keymap, history (undo/redo), indentation commands.                                                                                        |
| `@codemirror/search`        | ^6.7.1  | In-note search panel and `highlightSelectionMatches`. Vault-wide search is ours (the index), not this package.                                    |
| `@codemirror/autocomplete`  | ^6.20.3 | Completion framework: `[[` page completion, `/` slash commands, `@` citations later — each is just a completion source.                           |
| `@lezer/highlight`          | ^1.2.3  | Highlight tags mapping syntax nodes → style tags, so the editor theme is expressed in our design tokens.                                          |

**Gap analysis:** nothing essential is missing. Live Preview is decorations over the
`lang-markdown` tree (SilverBullet is the MIT reference); wikilinks are a small Markdown
parser extension plus a completion source. No additional editor framework is warranted.
