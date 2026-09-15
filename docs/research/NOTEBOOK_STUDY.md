# Notebook Study — QOwnNotes & srcbook

Research date 2026-09-12. Sources shallow-cloned to `~/Documents/GitHub/oss-study/`.
Goal: QOwnNotes' editing ergonomics + srcbook's cell mechanics, in our stack (React 19, TS, Tailwind v4, CM6, Markdown on disk).

## 1. License verdicts

**QOwnNotes app — GPL-2.0-only. BEHAVIOUR ONLY, NEVER COPY CODE.**
`LICENSE` = GPL v2, June 1991. Headers (`src/mainwindow.cpp:1-13`) narrow it: _"under the terms of the GNU General Public License … **version 2 of the License**"_ — no "or later". We may read it and describe what it does; we may not copy, translate line-by-line, or paste its regexes. Doing so forces Campus to GPL-2.0.

**qmarkdowntextedit (the editor widget) — MIT. COPYABLE.** The Markdown typing engine is _not_ in the GPL app. `.gitmodules` → `src/libraries/qmarkdowntextedit` → `github.com/pbek/qmarkdowntextedit`: _"The MIT License (MIT) Copyright (c) 2014-2026 Patrizio Bekerle … Permission is hereby granted, free of charge … to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies."_ Everything in §2.2 is legally portable, regexes included, given an MIT notice in `THIRD_PARTY.md`.

**srcbook — Apache-2.0. COPYABLE with attribution.** `LICENSE` is the Apache-2.0 boilerplate (unfilled `Copyright [yyyy]`; no `license` field in any `package.json`; README badge → Apache-2.0). Obligations: retain license + copyright, state changes, propagate any `NOTICE`. Patent grant included.

## 2. QOwnNotes — behaviour spec

### 2.1 Default keybindings (from `src/mainwindow.ui`, 91 shortcut-bearing actions)

| Shortcut                                         | objectName                                                                 | Behaviour                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+U`                   | `actionFormat_text_bold`/`_italic`/`_underline`                            | `applyFormatter("**")` / `("*")` / `("__")` (mainwindow.cpp:6118/6130/6123) |
| `Alt+Shift+S`                                    | `actionStrike_out_text`                                                    | `applyFormatter("~~")`                                                      |
| `Ctrl+Shift+C` / `Ctrl+Shift+B`                  | `actionInsert_code_block` / `_block_quote`                                 | fenced block / `> ` prefix                                                  |
| `Alt+Shift+T`                                    | `actionInsert_table`                                                       | table skeleton                                                              |
| `Alt+L`                                          | `actionInsert_checkbox_list_item`                                          | `- [ ] `                                                                    |
| `Ctrl+L` / `Ctrl+Shift+L`                        | `actionInsert_text_link` / `_note_link`                                    | `[text](url)` / note-link dialog                                            |
| `Ctrl+Shift+I` / `Ctrl+Shift+X` / `Ctrl+Shift+V` | `actionInsert_image` / `_attachment` / `actionPaste_image`                 | `![](…)` / attachment / paste HTML+media as Markdown                        |
| `Ctrl+D`                                         | `action_DuplicateText`                                                     | duplicate line or selection                                                 |
| `Ctrl+Backspace` / `Alt+Backspace`               | `actionDelete_word` / `_line`                                              | delete word / line                                                          |
| `Ctrl+Shift+U` / `Ctrl+Alt+I`                    | `actionToggle_text_case` / `actionSelect_enclosed_text`                    | cycle case / expand to enclosing delimiters                                 |
| `Ctrl+Space`                                     | `actionAutocomplete`                                                       | autocomplete word, solve equation, or open URL                              |
| `Alt+Shift+X`                                    | `actionSplit_note_at_cursor_position`                                      | split note in two at cursor                                                 |
| `Ctrl+Shift+PgDn` / `PgUp`                       | `action_Next_heading` / `_Previous_heading`                                | heading-to-heading jump                                                     |
| `Ctrl+R` / `Ctrl+Shift+F`                        | `actionReplace_in_current_note` / `action_Find_note`                       | replace in note / search all notes                                          |
| `Ctrl+0` `Ctrl++` `Ctrl+-`                       | `action_*_note_text_size`                                                  | font size                                                                   |
| `Ctrl+N` / `Alt+R`                               | `action_New_note` / `_Remove_note`                                         | new / delete note                                                           |
| `Alt+Up`/`Down`, `Alt+Left`/`Right`              | `actionPrevious_Note`/`Next_note`, `action_Back`/`Forward_in_note_history` | list nav / history                                                          |
| `Ctrl+1..9` / `Ctrl+Shift+1..9`                  | `actionGoto`/`Store_note_bookmark_N`                                       | 9 bookmark slots                                                            |
| `Alt+Shift+A`                                    | `action_new_tag`                                                           | tag current note                                                            |
| `F4`/`F5`/`F6`/`F7`                              | `actionJump_to_*`                                                          | focus editor / notes / subfolders / tags                                    |

**`applyFormatter` is a toggle** (mainwindow.cpp:6044-6113): it first calls `undoFormatting()`, which checks whether the selection is already wrapped in the formatter just outside the selection bounds and strips it. Otherwise: empty selection → insert `formatter+formatter`, cursor in the middle; non-empty → wrap the `^(\s*)(.+?)(\s*)$`-trimmed selection, preserving leading/trailing whitespace. Copy the toggle semantics exactly.

**Not bound by default:** `actionIncrease_heading_depth` / `actionDecrease_heading_depth` exist (`mainwindow.cpp:4972-4977`) with **no shortcut**. Campus should bind them (`Mod-Alt-ArrowUp/Down`, or `Mod-1..6` to set level directly). Also unbound: `action_FormatTable` (auto-align table at cursor), `actionInsert_footnote`, `actionToggle_checkboxes`, `actionCreate_{ordered,unordered,alphabetical,checkbox}_list`, `actionClear_list_formatting`.

**Genuine gaps — do not invent parity:** there is **no comment-toggle** and **no join-lines** action anywhere in the codebase. "Split" exists (`Alt+Shift+X`, splits the note in two); "join" does not.

Editor-level keys live in the MIT widget (`qmarkdowntextedit.cpp` `eventFilter`, :292-590), not the `.ui`:

| Shortcut                               | Behaviour                                           |
| -------------------------------------- | --------------------------------------------------- |
| `Tab` / `Shift+Tab`                    | list-aware indent/outdent (§2.2)                    |
| `Ctrl+Shift+Up`/`Down`                 | `moveTextUpDown()` — move line/selection            |
| `Ctrl+Alt+Down`                        | `duplicateText()`                                   |
| `Shift+Enter`                          | insert `"  \n"` — Markdown hard break               |
| `Ctrl+Enter` / `Ctrl+Shift+Enter`      | open line below / above, skipping list continuation |
| `Ctrl+C`/`Ctrl+X` with no selection    | copy/cut the whole current line incl. newline       |
| `F3` / `Shift+F3`, `Ctrl+F` / `Ctrl+R` | find next/prev, search/replace widget               |

### 2.2 Typing behaviour — the crown jewel (MIT, portable verbatim)

**`Enter` — `handleReturnEntered()` (:1813-1970), ordered cascade, first match wins:**

1. **Empty list item → erase the marker.** Line-start-to-cursor matching `^(\s*)([+|\-|\*] \[(x|-| |)\]|[+\-\*])(\s+)$` is deleted outright (no newline). Ordered equivalent: `^(\s*)(\d+[\.|\)])(\s+)$`. This is "Enter twice exits the list" — note it _erases in place_ rather than outdenting.
2. **Unordered / checkbox continuation.** Guard: line must start with `*`/`-`/`+` **followed by a space**, so `**bold**` never triggers it. Matches `^(\s*)([+|\-|\*] \[(x|-| |)\]|[+\-\*])(\s+)` and inserts `"\n" + whitespace + marker + trailingSpace`. **Checkboxes always continue unchecked:** a marker matching `^([+|\-|\*]) \[(x| |\-|)\]` is rewritten to `<char> [ ]`.
3. **Ordered auto-increment.** `^(\s*)(\d+)([\.|\)])(\s+)` → next line gets `n+1` with the same delimiter (`.` or `)`) and indentation. **Following items are not renumbered.**
4. **Indentation carry-over.** `^(\s+)` → next line inherits the leading whitespace.
5. **Enter at column 0 of a list item** inserts a new empty list item _above_ and parks the cursor there.

Block quotes (`> `) are **not** auto-continued (only rule 4 applies). No special code-fence handling on Enter.

**`Tab`/`Shift+Tab` — `handleTabEntered()` (:1974-2043).** Only with **no selection** and the cursor right after a bare list marker (`^(\s*)(marker)(\s+)$`) does it re-indent the item (append `indentCharacters`, or strip one `\t`/indent unit in reverse). Otherwise it falls through to `increaseSelectedTextIndention()`, which indents every selected line. So Tab in prose inserts an indent unit; Tab at the end of a list marker changes list level. **`indentCharacters` defaults to 4 spaces**, not a tab — `Utils::Misc::indentCharacters()` (misc.cpp:1902-1906) returns `\t` only if `Editor/useTabIndent` is set, else `" ".repeated(indentSize())` with `indentSize` defaulting to 4. (Quirk: for ordered lists Shift+Tab chops exactly **1** whitespace char rather than a full indent unit — asymmetric with the unordered case. Don't replicate that bug.)

**Auto-pairing — `handleBracketClosing()` (:823-935).** Pairs: `_openingCharacters = "([{<*\"'_~"` → `_closingCharacters = ")]}>*\"'_~"` (:53-54).

- **Surround selection:** typing an opener with text selected yields `open + selection + close` and **keeps the selection**.
- **Never auto-close mid-word:** bails if the char at the cursor is non-whitespace (except the bold-`*` case).
- **`*` is special:** no auto-close inside a code block, on an empty line (that's a new list), or without a preceding space/`*`. Typing the 2nd `*` when the line is exactly `*` emits `**` and centres the cursor → bold.
- **Backtick fence:** line matching `[^`]*`` ` → the 3rd backtick inserts ` `` ` and steps back 3, completing the pair.
- **Type-over — `bracketClosingCheck()` (:944-1000):** typing a closer already under the cursor moves right instead of inserting, but **only if openers-to-the-left > closers-to-the-left**. Smarter than CM6's default `closeBrackets`.
- **Paired deletion — `handleBackspaceEntered()` (:1065-1165):** Backspace over half a pair removes the partner. For `*` and `` ` `` it consults the highlighter's cached `_ranges` table (`QHash<blockNumber, QVector<InlineRange>>`) to delete the _whole_ delimiter run in one keystroke — an O(1) lookup, not a re-scan — and refuses to act inside a code span. For `"`/`'` the opener-vs-closer decision is made by whether the adjacent char is whitespace; for brackets it is purely positional. No cross-line matching.
- **`'` and `_` auto-pairing are deliberately disabled** (commented out, :348-353) — too common in prose and emphasis. Keep them off.

**Smart paste does NOT exist** — I checked, and this contradicts the common assumption. `insertFromMimeData` (`src/widgets/qownnotesmarkdowntextedit.cpp:2640-2651`) routes to the rich handler **only when the clipboard `hasUrls()`** (real OS file/URL mime, i.e. a dragged file). Pasting a URL _as text_ over a selection falls through to Qt's plain-text insertion and simply **overwrites the selection** — no `[selection](url)` wrapping. The only link-from-URL smartness is in the explicit `Ctrl+L` dialog (`handleTextNoteLinking`, mainwindow.cpp:4331-4347): if the trimmed selection parses as a `QUrl` whose scheme starts with `http`, it pre-fills the **URL** field and clears the name; otherwise it pre-fills the **name** field. With a name it emits `[name](url)`; with none, a bare autolink `<url>`. Real file/image mime does get handled richly (`handleInsertingFromMimeData`, mainwindow.cpp:5734-5929): images are saved and inserted as media, note/text files offer "new note" vs "attachment", HTML offers "paste HTML as Markdown". **Campus should do better than this** — paste-URL-over-selection → link is a well-known win.

### 2.3 Note management (GPL — behaviour only)

- **Filename derives from line 1** (`Note::handleNoteTextFileName()`, `src/entities/note.cpp:2886`): strip YAML frontmatter `^---…---\n`, strip a leading `^<!--…-->\n`, take line 1, remove `^#\s`, optionally strip a leading emoji, sanitize. Empty → `"Note"`.
- **Sanitization** (`cleanupFileName`, :2830): remove `[\/\\:]`, collapse `\s+` to one space. On FAT/NTFS also replace `[<>"|?*]` with spaces.
- **New-note naming is timestamp-first, so collisions are avoided by construction.** `Ctrl+N` calls `createNewNote(name, withNameAppend=true)`, and with that flag the name _always_ becomes `"Note " + QDateTime::toString("yyyy-MM-dd HH'h'mm's'ss")` → `Note 2026-09-12 14h32s07` (`noteoperationsmanager.cpp:446-456`). The default localized base name is `"Note"`. The note body is seeded with `Note::createNoteHeader(name)` = `"# " + name + "\n\n"`. A _third_ scheme exists for restore/import (`:476-495`): append `" " + toString(Qt::ISODate)` with `:`→`.`.
- **Duplicates on rename:** the rename path appends `" 1"`, `" 2"`, … (capped at 1000 iterations) until no _other_ note in the same subfolder owns that filename, excluding the note's own DB id.
- **Rename is live but one-way:** changing line 1 renames the file; the note body is deliberately never rewritten from the filename (explicit comment at :3000).
- **Link syntaxes, all simultaneous:** percent-encoded relative Markdown links `[Text](rel/path/Note.md#heading)` are the default (`getNoteUrlForLinkingTo`, :3206-3224); bare autolinks `<url>` when no display name is given; the legacy `note://<name>` scheme when `legacyLinking` is set **or automatically** whenever the relative path would contain `< > ( )` that would break the surrounding Markdown; plus `noteid://note-<id>`. Wiki links sit behind `Editor/wikiLinkSupport` (**default false**), regex `\[\[([^\[\]]+?)\]\]` (:98), grammar `[[Name]]`, `[[Name|alias]]`, `[[Name#Heading]]`, `[[Name#H|alias]]`, `[[folder/Name]]` (:5299-5305), resolved case-insensitively by name or filename-stem with **most-recently-modified winning** ties. Broken wiki links render with a distinct dashed-underline `a.wikilink.broken` style — a good affordance.
- **Tags live in SQLite, not in note text.** `tag(id, name, parent_id, priority, color, dark_color)` + join table `noteTagLink(tag_id, note_file_name, note_sub_folder_path)` (`src/entities/tag.cpp:39,63,100`). `parent_id` ⇒ **hierarchical tags**, with recursive child-tag note listing. Links are by _filename + subfolder path_, not id — which is why renames must update the table.

### 2.4 Why it feels fast

- **Incremental highlighting with a deferred dirty queue** — the most copyable idea. `markdownhighlighter.cpp` highlights **one block at a time** and caches the verdict in `block.userState()`. When highlighting block N reveals block N-1 was wrong (e.g. a setext underline), it does _not_ re-highlight immediately: `addDirtyBlock(prev)` (:470-476) appends to a de-duplicated `_dirtyTextBlocks`. A **1 s `QTimer`** (:66-69) drains it in `timerTick()` → `reHighlightDirtyBlocks()` (:84-103), emitting `highlightingFinished()` at most once a second. Typing never cascades; corrections settle within a second. CM6 gives us the incremental-parse half free via Lezer + `syntaxTree()`; the dirty-queue half maps onto a `ViewPlugin` with a timer/idle drain.
- **Nothing happens per keystroke.** Preview regeneration is **debounced 600 ms** (`MainWindow/noteTextView.refreshDebounceTime`, misc.cpp:3280-3284) — a single-shot timer restarted on every `textChanged`, so Markdown→HTML (via **md4c**, a C parser, not a regex pipeline) rebuilds only once typing pauses. Separately, periodic timers (`mainwindow.cpp:405-432`) do an autosave sweep of dirty notes every **10 s**, a note-view poll every 2 s, git autocommit every 30 s, housekeeping every 60 s. The editor never blocks on I/O, and the search widget debounces too.
- **Hard size cap:** files larger than `maxNoteFileSize`, **default 1 MiB** (misc.cpp:3286-3288), are skipped entirely during indexing — never loaded, never listed. Campus should adopt an explicit cap rather than degrading silently.
- **Reindex skips unchanged files:** `Note::updateOrCreateFromFile` (note.cpp:3608-3630) re-reads a file only when `size` differs or `lastModified` is newer. Folder switches run a diff-and-reconcile pass against the previous id set rather than wipe-and-rebuild.
- **An in-memory SQLite table mirrors the folder** (`QSqlDatabase::database("memory")`, databaseservice.cpp:685-704) so search, tag queries and the note list never stat the filesystem; the `.md` files remain the source of truth and the table is a rebuildable cache. Search is `LIKE`-based — **no FTS**.
- **Counter-example, do not copy:** the folder scan is synchronous on the main thread behind a modal progress dialog, pumping `sendPostedEvents()` per file (noteindexmanager.cpp:163-197), and the note tree/list are plain Qt widgets with no custom virtualization. Campus should scan in a Web Worker (or chunked async) and virtualize the note list.

## 3. srcbook — notebook mechanics

### 3.1 Cell model & serialization

Schemas `packages/shared/src/schemas/cells.mts`; types `packages/shared/src/types/cells.mts`. Five types, all `{ id, type, … }` with `id = randomid()` (16 random bytes, base32hex, lowercased — `packages/shared/src/utils.mts:9`):

| Type           | Fields                                                        |
| -------------- | ------------------------------------------------------------- |
| `title`        | `text` (max 44 chars on update)                               |
| `markdown`     | `text`                                                        |
| `code`         | `source`, `language`, `filename`, `status: 'idle'\|'running'` |
| `package.json` | `source`, `filename: 'package.json'`, `status`                |
| `placeholder`  | `text` — client-only, marks where AI will insert cells        |

**One notebook = one `.src.md` file** (`isSrcmdPath`: `endsWith('.src.md')`). Plain GFM with three conventions (`packages/api/srcmd/encoding.mts`):

1. Line 1 is an HTML comment carrying JSON: `<!-- srcbook:{"language":"typescript"} -->`, parsed by `/^<!--\s*srcbook:(.+)\s*-->$/` (`decoding.mts:71`).
2. The single **`# h1`** is the title cell.
3. An **`###### h6`** is a _filename marker_; the block after it is that file's content — either an inline fence, or `[name](./src/name)` for the "external" flavour where code lives in real files beside a `README.md` (`srcmd.mts:decodeDir`).

Everything else is a markdown cell. Cells join with `\n\n`; the file ends in exactly one newline. Working sample: `packages/api/test/srcmd_files/srcbook.src.md`.

**Decoding** (`packages/api/srcmd/decoding.mts`) is a 3-stage pipeline worth copying wholesale: `marked.lexer(contents)` → `groupTokens()` folds the flat token list into `title | filename | code | code:linked | markdown` groups (consecutive markdown tokens accumulate into one group) → `validateTokenGroups()` → `convertToCells()`. Markdown cells are re-serialized from `token.raw` with `\n{3,}` collapsed to `\n\n` (`serializeMarkdownTokens`, :393), so **round-trip is lossless** except for excess blank lines. `decodeCells()` is the same pipeline minus the metadata requirement, for AI-generated fragments.

Deliberate constraints: `h1` and `h6` are **reserved** — a markdown cell containing either is rejected on save with _"Markdown cells cannot use h1 or h6 headings"_ (`components/src/components/cells/markdown.tsx:46-58`). A fenced block _not_ preceded by an `h6` renders as markdown, not as a runnable cell.

### 3.2 Cell UI

- **Framing** (`packages/components/src/components/cells/code.tsx:160-178`): outer `div.relative.group/cell` with `id={"cell-"+cell.id}` (scroll anchor), inner `div.border.rounded-md.group`. Active state is a **ring**, layered: `ring-run-ring` while running, `ring-ai-ring` while generating, else `focus-within:ring-1 focus-within:ring-ring focus-within:border-ring`. `focus-within` is the whole trick — no manual "active cell" state needed.
- **Toolbar** is a header row inside the border, revealed by `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity`. Left: editable filename input. Right: run/stop, format, AI, copy, maximize, delete.
- **Markdown cell is two-mode, not live-preview** (`markdown.tsx:70-76`): `status: 'edit' | 'view'`, defaulting to `view` when `cell.text` is non-empty and `edit` when empty (new cells open ready to type). `onDoubleClick` enters edit; `Escape` or `Mod-Enter` returns to view. View renders via `marked-react` into `.sb-prose`, with a custom renderer routing ` ```mermaid ` to a mermaid `<pre>`.
- **Insert between cells** (`packages/web/src/routes/session.tsx:458-500`): an `InsertCellDivider` renders _before every cell_ and once after the last — a 20 px `opacity-0 hover:opacity-100` strip with a 1 px rule and a floating segmented button group (`TypeScript | Markdown | Generate with AI`). Insertion index is `idx + 2` because title and `package.json` occupy slots 0 and 1.
- **Keyboard navigation between cells does not exist.** The only global hotkeys are `?`, `Mod+;` (open package.json), `Mod+i` (install package) — `packages/web/src/components/keyboard-shortcuts-dialog.tsx`. Navigation is mouse-driven plus a ToC panel doing `document.getElementById('cell-'+id).scrollIntoView()` (`session-menu/table-of-contents-panel.tsx:35`). **A gap, not a model.**
- **Cell list state** (`packages/components/src/components/use-cell.tsx`): a context holding `cellsRef: useRef<ClientCellType[]>` plus a `useReducer` force-rerender — refs to dodge stale closures. `insertCellAt` is `copy.splice(idx, 0, cell)`. New code cells get `untitled.ts`, `untitled1.ts`, … (`generateUniqueFilename`, :29-42).

### 3.3 CodeMirror 6 integration — directly reusable

- **One editor instance per cell.** No single document. Each cell renders its own `<CodeMirror>` from `@uiw/react-codemirror` 4.23 (`code.tsx:532-559`, `markdown.tsx:213-220`).
- **Extensions are assembled as a plain array in the container and passed down as a prop** (`packages/web/src/components/cells/code.tsx:368-430`); the presentational cell never builds them. Order is documented as significant ("we call tsLinter before tsHover"): `javascript({typescript:true})` → `tsHover()` (custom `hoverTooltip`, `cells/hover.ts`) → `linter()` fed by tsserver diagnostics over a websocket → `autocompletion({ override: [ctx => getCompletions(ctx, cell, channel)] })` (`cells/get-completions.ts`) → `Prec.highest(EditorView.domEventHandlers({click}))` for Alt-click go-to-definition via `view.posAtCoords({x,y})` → `Prec.highest(keymap.of([{key:'Mod-Enter',run:runCell},{key:'Shift-Alt-f',run:formatCell}]))` → conditionally `EditorView.editable.of(false)` + `EditorState.readOnly.of(true)`.
- **`Prec.highest` on every app keymap** so cell bindings beat `defaultKeymap`. Copy this.
- **Markdown cell extensions are minimal:** `[markdown(), Prec.highest(keymap.of([Mod-Enter, Escape])), EditorView.lineWrapping]`, with `basicSetup={{lineNumbers:false, foldGutter:false}}` and `indentWithTab={false}`.
- **Theming** (`packages/components/src/lib/code-theme.ts`): `createTheme()` from `@uiw/codemirror-themes` where `settings` point at **CSS custom properties** (`background: 'var(--background)'`, `gutterForeground: 'hsl(var(--muted-foreground))'`) and `styles` maps Lezer tags to **Tailwind class strings** (`{tag:[t.keyword], class:'text-[#ff7b72]'}`) instead of inline styles. Exports `srcbookLight`/`srcbookDark`, chosen by `useTheme()`. The same tag arrays are reused by a standalone `formatCode()` running `@lezer/javascript` + `highlightCode()` to produce highlighted DOM outside any editor.
- **Persistence:** `onChange` → `updateCellOnClient` immediately (optimistic) + `useDebouncedCallback(updateCellOnServer, 500)` (`DEBOUNCE_DELAY = 500`).
- **Diff review:** `unifiedMergeView({original, mergeControls:false, highlightChanges:false})` from `@codemirror/merge` in a read-only editor.

### 3.4 Markdown cell vs code cell

|             | Markdown cell                       | Code cell                                              |
| ----------- | ----------------------------------- | ------------------------------------------------------ |
| Storage     | inline in the `.src.md`             | `###### name.ts` + fence, or external `./src/name.ts`  |
| Extensions  | `markdown()`, 2 keys, line wrapping | JS/TS lang, hover, linter, autocomplete, 2 keys        |
| Mode        | `edit` ⇄ `view` (rendered)          | single mode, always mounted                            |
| `Mod-Enter` | save + return to view               | run the cell                                           |
| Toolbar     | label, delete, edit/cancel/save     | filename, run/stop, format, AI, copy, maximize, delete |
| Extra state | validation error (no h1/h6)         | `status`, stdout/stderr panel, diagnostics             |

## 4. Portable vs must-reimplement, for Campus

### Directly portable (license-clean)

1. **The whole srcmd decode/encode pipeline** (Apache-2.0): `marked.lexer` → `groupTokens` → `validate` → `convertToCells`, the `\n{3,}`→`\n\n` normalization, and `join('\n\n').trimEnd()+'\n'`. Campus already targets Markdown-on-disk; this gives us cells without inventing a container format. Swap `###### filename` for whatever Campus needs.
2. **The `<!-- campus:{…} -->` metadata header trick** — valid Markdown, renders as nothing everywhere else.
3. **CM6 extension-assembly pattern**: build `Extension[]` in the container, pass as a prop, wrap every app keymap in `Prec.highest`. Campus uses raw `@codemirror/*` with `new EditorView(...)` (`src/components/workspace/note-editor.tsx:136-175`) rather than `@uiw/react-codemirror`, so the array goes to `EditorState.create({extensions})` — same shape, one fewer dependency.
4. **The CSS-variable theme approach** (`code-theme.ts`): point CM6 `settings` at Tailwind v4 custom properties, express `styles` as Tailwind classes. Align our existing `src/components/workspace/editor-theme.ts` to this so light/dark needs no JS swap.
5. **`focus-within:ring` for the active-cell frame**, `group/cell` hover-revealed toolbars, and the hover-revealed `InsertCellDivider` between every pair of cells.
6. **500 ms debounced persist + immediate optimistic local update.**
7. **All of §2.2's typing algorithms** (MIT): the Enter cascade, empty-marker erase, unchecked checkbox continuation, ordered auto-increment, list-aware Tab, the `*`/backtick auto-pair special cases, count-aware type-over, paired backspace. Port the regexes verbatim; credit qmarkdowntextedit (MIT) in a NOTICE.

### Must reimplement from scratch (GPL-2.0-only — behaviour only)

1. **The §2.1 keybinding table.** Shortcut→intent mappings are not copyrightable expression, but do not port any `MainWindow::on_action*_triggered` body. Write our own CM6 commands (`toggleBold`, `toggleHeading`, `insertTable`, `splitNote`, …).
2. **Note naming / rename-on-first-line / duplicate suffixing.** Adopt the _rules_ (strip frontmatter, strip `^#\s`, sanitize `[\/\\:<>"|?*]`, collapse whitespace, suffix `" 1"`, `" 2"`, never rewrite the body); implement fresh in TS.
3. **Note linking.** Match the model: `[[Name]]`, `[[Name|alias]]`, `[[Name#Heading]]`, `[[folder/Name]]`, plus the broken-link dashed-underline affordance.
4. **Tag storage.** Tags in the index (not in note text), `parent_id` hierarchy, recursive child-tag listing. Campus has `src/lib/db/` — model it there.
5. **Smart paste — build it, don't port it.** QOwnNotes has no URL-over-selection linking (§2.2). Implement it fresh as a CM6 `EditorView.domEventHandlers.paste`: URL + selection → `[selection](url)`; URL alone → autolink; image → attachment + `![](…)`. Borrow only the Ctrl+L dialog's URL-detection heuristic (scheme starts with `http`).
6. **The §2.4 performance discipline** — 600 ms preview debounce, 10 s autosave sweep, debounced search, a 1 MiB per-file cap, mtime/size-based reindex skipping, and an index instead of filesystem scans. Architecture, not code — but do the scan off the main thread and virtualize the list, which QOwnNotes does not.

### Copy from neither

- srcbook's **missing cell keyboard navigation.** Campus should add `Mod-ArrowUp/Down` to move focus between cells, `Escape` to leave a cell editor for a cell-level command mode, and `Mod-Shift-Enter` to insert a cell below.
- srcbook's **title and `package.json` as pseudo-cells at fixed indices 0 and 1** — their own code says `// TODO: We need to stop treating titles and package.json as cells` (`session.tsx:284`). Keep notebook metadata out of the cell array.
- QOwnNotes' **Enter-on-empty-list-item erasing the marker in place** instead of outdenting first. Multi-level lists want outdent → outdent → … → erase.
