---
name: campus-supabase
description: Campus backend rules — local Supabase stack, migrations-only schema changes, generated DB types, Auth, Row Level Security policy and isolation testing, seed conventions, service-role handling. Use when touching supabase/**, src/lib/db/**, writing SQL, changing schema, or reasoning about data access and multi-user isolation.
---

# Campus — Supabase / data rules

## Local stack

Supabase runs locally via Docker. The CLI is a **project devDependency**, not a global tool.

```bash
pnpm supabase start        # boots Postgres, Auth, PostgREST, Studio
pnpm supabase status       # ports + anon key
pnpm supabase stop
pnpm db:reset              # supabase db reset — reapplies ALL migrations + seed
pnpm db:types              # regenerate src/lib/db/database.types.ts
```

If Docker is not running, `supabase start` fails. That is a **stop condition** — report it,
do not fake database evidence.

## Migrations only — no exceptions

Schema changes happen **exclusively** through timestamped files in `supabase/migrations/`.

```bash
pnpm supabase migration new <descriptive_snake_case_name>
```

- Never mutate schema through Studio and never `db push` an undeclared change.
- Never edit a migration that has already been committed — write a new one.
- Every migration must be idempotent-safe under `db reset` (the canonical path is: drop,
  replay all migrations in order, run seed).
- Migrations are the source of truth for the schema. `database.types.ts` is a _derivative_ —
  regenerate it after every migration, never hand-edit it.

## Naming conventions

- tables: plural `snake_case` (`curriculum_subjects`, `user_subject_states`)
- PKs: `id uuid primary key default gen_random_uuid()`
- FKs: `<singular>_id` with an explicit `references ... on delete <policy>`
- timestamps: `created_at timestamptz not null default now()`, `updated_at` via trigger
- enums: Postgres `create type` for closed domains (`subject_status`, `prerequisite_kind`,
  `academic_item_kind`) — not free-text `check` strings
- every FK column gets an index; every RLS predicate column gets an index

## The two data tiers

| Tier                                  | Tables                                                                                                        | Ownership                                   | RLS                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| **Reference (curated academic data)** | `institutions`, `academic_units`, `programs`, `curricula`, `subjects`, `curriculum_subjects`, `prerequisites` | project-owned, seeded from official sources | readable by any authenticated user; **no client write path at all** |
| **User-owned**                        | `profiles`, `user_academic_contexts`, `user_subject_states`, `academic_items`, `resources`                    | one user                                    | full CRUD restricted to `auth.uid() = user_id`                      |

## RLS — mandatory

**Every table has `alter table ... enable row level security`.** A table without RLS is a
review-blocking defect, even if it is read-only reference data (enable RLS, then add a
permissive select policy — explicit beats implicit).

Policy shape for user-owned tables — write all four separately, never `for all`:

```sql
create policy "own rows readable"   on public.academic_items for select
  using (auth.uid() = user_id);
create policy "own rows insertable" on public.academic_items for insert
  with check (auth.uid() = user_id);
create policy "own rows updatable"  on public.academic_items for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows deletable"  on public.academic_items for delete
  using (auth.uid() = user_id);
```

`with check` on insert **and** update — omitting it on update lets a user reassign a row to
someone else. That is the classic hole; check for it in review.

### RLS isolation tests are required evidence

`supabase/tests/` (or `tests/db/`) must contain an **A/B isolation test**: create user A and
user B, have A insert rows, then assert with B's JWT that:

- B cannot `select` A's rows (0 rows, not an error)
- B cannot `update` or `delete` A's rows
- B cannot `insert` a row carrying A's `user_id`

Run against the **local** stack, with the anon key and real JWTs — never with service-role.
"RLS is enabled" is a claim; the A/B test is the evidence.

## Auth

Supabase Auth, email + password for the POC. Session is held by the Supabase JS client;
the app reads it through one `AuthProvider`. `profiles` is created by a trigger on
`auth.users` insert — never by the client.

Minimal by design: no OAuth providers, no magic links, no MFA in the POC.

## Service-role — never in the frontend

- The frontend uses **only** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` may exist only in a local `.env` consumed by Node scripts
  (seeding, tests). It must never be imported into anything under `src/`, never prefixed
  with `VITE_`, and never committed.
- `.env` is gitignored; `.env.example` is committed with placeholder values.
- Grep for `service_role` under `src/` in review. Any hit is a blocker.

## Seed conventions

`supabase/seed.sql` holds **reference data only** — institutions, units, programs, curricula,
subjects, prerequisites. Never user rows (users come from Auth).

Every seeded `curricula` row carries provenance: `source_url`, `source_kind`,
`source_fetched_at`. Seed data is generated from the verified JSON under
`docs/research/curricula/` — do not hand-type subject lists, and **never invent a subject,
a year, or a correlativa** (P-05). If a fact is not in the researched source, it does not
go in the seed.

## Storage

Resources start as **links and text**. File upload ships only if owner, size, content-type
and path validation are proven — otherwise `storage_path` stays null and the UI does not
offer upload.

## Client boundary

`src/lib/db/` is the only place that imports `@supabase/supabase-js` types or knows column
names. It maps DB rows → domain types. Screens import domain types, never `Database['public']...`.
