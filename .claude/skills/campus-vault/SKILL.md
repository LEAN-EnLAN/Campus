---
name: campus-vault
description: Campus vault doctrine — safe filesystem access, path traversal and symlink policy, atomic writes, external-change detection and conflicts, watchers, trash, rename/move, attachments, and the derived SQLite index. Use when touching anything that reads or writes the student's folder.
---

# Campus — the vault

The vault is a **normal folder the student chose**. Campus is a guest in it.

## Scope is the security boundary

Every path that reaches the filesystem is resolved and checked against the vault root
**before** any I/O. There is one function that does this and everything goes through it.

Attacks that must be blocked, and are non-negotiable test cases:

```text
../../../etc/passwd          relative traversal
/etc/passwd                  absolute escape
a/../../..                   traversal after a valid segment
symlink → outside vault      symlink escape on read AND on write
rename target outside vault  escape via move
attachment path outside      escape via attachment
NUL bytes, control chars     malformed filename
very long path               length limits
```

Policy:

- resolve to a real absolute path (`realpath`) and require it to be inside the vault root
- check the **resolved** path, not the string — string prefix checks are defeated by symlinks
- a symlink pointing outside the vault is **not followed**; it is surfaced as such
- never accept a path from the UI and pass it to the filesystem unchecked

## Atomic writes

Never `open(path, 'w')` on a note. A crash mid-write destroys the student's work.

```text
write to  <file>.campus-tmp-<random>  in the same directory
fsync
rename over the target        ← atomic on the same filesystem
```

Same directory matters: `rename` is only atomic within a filesystem.

## External change is normal, not an error

A vault is edited by other things: a text editor, `git checkout`, Dropbox, the student's own
`mv`. Campus must expect it.

**Never silently overwrite a file that changed on disk after Campus loaded it.**

Track, per open file, the modification time and size seen at load. Before writing, re-stat.
If it changed, this is a **conflict** and the student decides. A conflict is a first-class UI
state, not a toast.

Mandatory scenarios:

```text
edit in Campus, save                          → clean
edit externally while open in Campus          → conflict surfaced
rename externally                             → tree updates, open tab follows or reports
move a folder externally                      → tree updates
delete externally while open                  → tab reports, buffer preserved
git checkout rewrites many notes              → index catches up, nothing lost
```

## Watcher

- **recursive**, over the vault only. Never over `$HOME`.
- **debounced** — editors write several times per save; a burst is one logical change
- **rename-aware** — a rename is not delete+create; treating it as such destroys backlinks
- **bounded** — a watcher that queues unbounded events on a 50k-file vault takes the app down
- **ignores derived noise** — `.campus/index.sqlite`, its WAL, caches. Watching your own
  index writes is an infinite loop with extra steps.

Large-vault tests are mandatory, not optional.

## Trash, not delete

Deleting moves to `.campus/trash/` with enough metadata to restore the original path.
Emptying trash is a separate, explicit action. `unlink` on a student's note as the first
resort is indefensible.

## Rename and move

A rename is a **transaction**: the file moves and every wiki link pointing at it updates.

- bounded: know how many files will change before doing it, and say so
- evidence-backed: report what changed
- **ambiguity is never resolved silently.** Two notes named `CPU.md` in different folders and
  a link `[[CPU]]` — ask, do not guess. A wrong guess quietly retargets the student's
  knowledge graph.

## Attachments

Attachments live in the vault (`Attachments/` by default) and are referenced by relative
path. Campus does not copy the student's files into a database. In LOCAL mode the student
already owns the file; duplicating it into a bucket is the opposite of the product.

## The derived index

SQLite at `.campus/index.sqlite`, **derived only** (see `campus-local-first`). It holds:

```text
file metadata · note metadata · headings · tags · properties
wiki links · backlinks · FTS5 content · search ranking
```

Requirements:

- a **Rebuild index** command exists and is reachable from the UI
- acceptance: `rm .campus/index.sqlite` → restart → Campus rebuilds → no note or data loss
- the index is never the only home for a fact the student typed

## Review checklist

- [ ] every filesystem path went through the one resolver
- [ ] writes are atomic
- [ ] the pre-write stat check is present
- [ ] the watcher is vault-scoped, debounced and ignores `.campus` derived files
- [ ] delete goes to trash
- [ ] rename updates links transactionally and asks on ambiguity
- [ ] nothing canonical lives only in SQLite
