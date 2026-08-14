---
name: campus-editor
description: Campus editor doctrine — Markdown as the only document model, CodeMirror 6 architecture and extension composition, wiki links, YAML properties round-tripping, templates, edit/reading modes, and integration with the command registry. Use when building or changing anything in the note editing surface.
---

# Campus — the editor

## Markdown is the document model. There is no other one.

The file on disk is the truth. Campus does not keep a parallel rich-text tree, a block store,
or a "document JSON" that Markdown is exported from. Every feature is expressed as Markdown
plus YAML frontmatter, or it does not ship.

The test: open the note in `vim`, change it, come back. Campus agrees.

**Do not create a competing document model.** This is the single decision that separates a
local-first editor from a note app that happens to export Markdown.

## CodeMirror 6 architecture

CM6 is a set of composable extensions over an immutable `EditorState`. Use it that way.

```text
src/features/editor/
├── editor-view.tsx          the React shell — small, mounts CM, nothing else
├── state/                   extension composition
└── extensions/
    ├── markdown.ts          language + syntax
    ├── wiki-link.ts         parse, decorate, complete, navigate
    ├── properties.ts        frontmatter awareness
    ├── code-block.ts        the run/copy controls
    ├── subject-complete.ts  academic autocompletion
    └── tag-complete.ts
```

Rules:

- **one concern per extension file.** A 2,000-line `NoteEditor` component is the failure this
  structure exists to prevent.
- extensions are plain CM6 values, not React. They must be unit-testable without rendering.
- the React shell owns mounting, focus and lifecycle. It does not own editing logic.
- state changes flow through CM transactions, never by reaching into the DOM.
- `Compartment` for anything reconfigurable at runtime (theme, reading mode, read-only).

## Modes

| Mode        | What it is                                  |
| ----------- | ------------------------------------------- |
| **Edit**    | CodeMirror with the Markdown source visible |
| **Reading** | rendered output, no editing affordances     |

Live Preview (decorated source) may come later **only if the extension set stays
maintainable**. It is a decoration layer over the same state — never a third document model.

## Wiki links

```markdown
[[Nota]]
[[Nota|Alias]]
```

Behaviour:

- autocomplete from the vault index as the student types
- a link to a non-existent note is a **broken-link state**, visibly distinct, not an error
- clicking navigates; the link target resolution rules are written down and testable
- **rename safety belongs to the vault layer** (see `campus-vault`) — the editor surfaces it,
  it does not own it
- ambiguity is never silently resolved

## Properties (YAML frontmatter)

```yaml
---
subject: arquitectura
type: lecture
date: 2026-08-14
tags: [cpu, pipeline]
---
```

Initial types: `text · number · date · boolean · select · multi-select · tags · subject ·
status`.

**Round-tripping is the hard requirement.** The visual property editor must not destroy
fields it does not understand, and should preserve comments and key order where practical.
The student can always edit the YAML directly.

Test this explicitly: frontmatter with unknown keys, comments, nested maps and an array →
edit one property through the UI → diff the file. Only the intended line changed.

## Templates

Templates are **normal files in the vault**, not a hidden registry. A student can read, edit
and version them.

Initial set: Daily · Lecture · Assignment · Exam · Reading · Course overview · Project.

Variables: `{{date}} {{time}} {{title}} {{subject}}`. Keep substitution boring and
documented. No expression language, no AI.

## Daily notes

`Daily/YYYY-MM-DD.md`, pattern configurable later.

Daily Note and Today are **different things** and must stay different:

| Today                                                          | Daily Note                          |
| -------------------------------------------------------------- | ----------------------------------- |
| academic operational view — what is due, what you are cursando | freeform notebook page for that day |

Today may link to or embed today's Daily Note. It must not become it.

## Integration

The editor registers commands rather than owning menus (see the command registry): create
note, toggle reading mode, insert template, run code block, follow link.

## Review checklist

- [ ] is the file on disk still plain Markdown a human can read?
- [ ] is there exactly one document model?
- [ ] does any extension file exceed one concern?
- [ ] can the extension be tested without React?
- [ ] does the property editor preserve unknown frontmatter?
- [ ] is a broken link a state, not a crash?
