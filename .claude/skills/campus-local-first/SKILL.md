---
name: campus-local-first
description: Campus local-first doctrine — canonical files vs derived indexes, runtime modes (LOCAL/CLOUD), the CampusBackend boundary, local identity without accounts, offline behaviour, and future conflict semantics. Use before touching src/features/**, adding any persistence, or deciding where a piece of state lives.
---

# Campus — local-first doctrine

## The promise

> A student who stops using Campus must still own **normal folders, Markdown, attachments
> and portable JSON**, all readable without Campus.

Everything below exists to keep that promise true. If a design makes Campus the only thing
that can read the student's work, the design is wrong.

## Canonical vs derived — the single most important distinction

| Canonical                                                 | Derived                |
| --------------------------------------------------------- | ---------------------- |
| Markdown files                                            | `.campus/index.sqlite` |
| attachments                                               | search index           |
| `.campus/*.json` (academic context, subject state, items) | backlink index         |
| the folder tree itself                                    | caches, thumbnails     |

**Deleting every derived artefact must lose nothing but time.** The acceptance test is
literal: `rm .campus/index.sqlite`, restart, everything is still there.

The inverse is the failure mode to hunt for in review: any fact that exists **only** in the
index is a canonical fact hiding in a derived store. Move it into a file.

## No hidden canonical database

Postgres is a _backend_, not _the truth_. In LOCAL mode there is no database at all and the
product must be complete. If a feature cannot be expressed over files, it either does not
belong in LOCAL mode or it needs a file format — not a table.

## Runtime modes

```ts
type CampusRuntime =
  | { mode: 'local'; vault: VaultDescriptor; profile: LocalProfile }
  | { mode: 'cloud'; session: CloudSession }
```

| Mode                 | Requires                                                          | State                          |
| -------------------- | ----------------------------------------------------------------- | ------------------------------ |
| **LOCAL**            | a folder. No account, no network, no Supabase.                    | shipping target                |
| **CLOUD**            | Supabase Auth + Postgres + RLS — today's POC behaviour, unchanged | must not regress               |
| **LOCAL_PLUS_CLOUD** | —                                                                 | **documented only, not built** |

LOCAL mode must **never** fabricate a Supabase user to satisfy a code path. If something
demands `session.user.id`, that code is reaching past the boundary and must be fixed, not
worked around.

## The backend boundary

```text
React components
      ↓
TanStack Query hooks          ← still the caching layer, unchanged
      ↓
CampusBackend                 ← the only seam
   ┌──┴───────────┐
LocalBackend   SupabaseBackend
```

Rules:

- **React never knows where data comes from.** No `if (mode === 'local')` inside a component.
- Hooks depend on `CampusBackend`, never on `@supabase/supabase-js`.
- `src/domain/**` stays pure and backend-agnostic — it takes plain data and returns plain
  data, exactly as it does today.
- `src/lib/db/**` remains the _Supabase_ mapping boundary; it becomes an implementation
  detail of `SupabaseBackend`, not a shared utility.

**Keep the interface small.** One method per real use case that already exists in the app.
No repository-per-entity ceremony, no generic `find(criteria)`. If a method has no caller,
delete it.

## Local identity

A LOCAL profile is a display name and preferences in `.campus/settings.json`. That is all.

- no password, no token, no session expiry
- no per-user row filtering — the vault _is_ the scope
- RLS has no meaning locally; the OS filesystem permissions are the boundary

## Offline

LOCAL mode is offline by construction. The rule that matters is the negative one: **no
feature may block on the network in LOCAL mode.** Fonts, avatars, telemetry, update checks —
all optional, all non-blocking, none of them on the path to opening a note.

## Conflict semantics — design now, build later

Do not implement sync. Do document it, because these four things conflict differently and a
single strategy for all of them is the trap:

| Data              | Conflict shape                    | Sketch                                                                      |
| ----------------- | --------------------------------- | --------------------------------------------------------------------------- |
| file content      | two edits to one Markdown file    | keep both, surface the conflict, never silently pick                        |
| academic metadata | two edits to `subject-state.json` | per-entity merge; last-write-wins is defensible per subject, never per file |
| device settings   | window layout, vault paths        | **never syncs**. Device-scoped by definition                                |
| cloud identity    | account-level                     | server authoritative                                                        |

**Never design "last write wins" as an implicit global default.** Writing that sentence into
a design doc is how a student loses a semester of notes.

## Review checklist

- [ ] does this work with the network unplugged and no Supabase?
- [ ] is every new fact stored in a canonical file, not only in the index?
- [ ] does any component import Supabase directly?
- [ ] does any code path require a `user_id` in LOCAL mode?
- [ ] can the student read this data in a text editor a year from now?
