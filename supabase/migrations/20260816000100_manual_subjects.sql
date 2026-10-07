-- Campus — subjects a student types in by hand.
--
-- For a carrera that is not in the catalog (CAP-ONBOARD-002) the student adds
-- their own subjects. They are NOT curriculum rows: the reference tier is
-- read-only for everyone, and a manual subject has no correlativas, so nothing
-- may ever derive "available" or "blocked" for it. The row carries its own
-- status because `user_subject_states` points at `curriculum_subjects`.
--
-- Same ownership model as every other user table: one user owns the row, four
-- separate RLS policies, `with check` on insert AND update, no anon access.
-- See 20260814000200_user_data.sql and 20260814000300_grants.sql.

create table public.user_manual_subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 200),
  year_level  smallint not null check (year_level between 1 and 10),
  term        public.academic_term not null default 'anual',
  -- Only EXPLICIT statuses are stored; null is "Sin marcar".
  status      public.subject_status,
  grade       numeric(4, 2) check (grade is null or (grade >= 0 and grade <= 10)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Target of the composite foreign keys below: lets an entrega or a resource
  -- point at a manual subject only when the SAME user owns both rows.
  unique (id, user_id)
);

create index user_manual_subjects_user_id_idx on public.user_manual_subjects (user_id);

create trigger user_manual_subjects_touch_updated_at
  before update on public.user_manual_subjects
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------

alter table public.user_manual_subjects enable row level security;

create policy "own manual subjects readable"   on public.user_manual_subjects for select to authenticated
  using (auth.uid() = user_id);
create policy "own manual subjects insertable" on public.user_manual_subjects for insert to authenticated
  with check (auth.uid() = user_id);
create policy "own manual subjects updatable"  on public.user_manual_subjects for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own manual subjects deletable"  on public.user_manual_subjects for delete to authenticated
  using (auth.uid() = user_id);

-- `anon` deliberately receives nothing, exactly like the rest of the user tier.
grant select, insert, update, delete on table public.user_manual_subjects to authenticated;

-- --------------------------------------------------------------------------
-- Entregas and material can belong to a manual subject
-- --------------------------------------------------------------------------

-- `curriculum_subject_id` references the catalog, so it cannot hold a manual
-- subject. A second nullable column does, and the composite key below makes the
-- database refuse a link to anyone else's manual subject WITHOUT touching the
-- existing policies (MATCH SIMPLE: a null manual_subject_id is not checked).
alter table public.academic_items add column manual_subject_id uuid;
alter table public.academic_items
  add constraint academic_items_manual_subject_owner_fkey
  foreign key (manual_subject_id, user_id)
  references public.user_manual_subjects (id, user_id)
  on delete set null (manual_subject_id);
alter table public.academic_items
  add constraint academic_items_one_subject_check
  check (curriculum_subject_id is null or manual_subject_id is null);
create index academic_items_manual_subject_id_idx on public.academic_items (manual_subject_id);

alter table public.resources add column manual_subject_id uuid;
alter table public.resources
  add constraint resources_manual_subject_owner_fkey
  foreign key (manual_subject_id, user_id)
  references public.user_manual_subjects (id, user_id)
  on delete set null (manual_subject_id);
alter table public.resources
  add constraint resources_one_subject_check
  check (curriculum_subject_id is null or manual_subject_id is null);
create index resources_manual_subject_id_idx on public.resources (manual_subject_id);
