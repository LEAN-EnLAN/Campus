-- Campus — user-owned data.
--
-- Every table here is owned by exactly one user. Every one gets four separate
-- RLS policies (select/insert/update/delete). `with check` appears on BOTH insert
-- and update: omitting it on update would let a user reassign a row to someone
-- else, which is the classic hole.
--
-- See .claude/skills/campus-supabase/SKILL.md

create type public.subject_status as enum (
  'in_progress',
  'regularized',
  'passed',
  'failed',
  'equivalent'
);

create type public.academic_item_kind as enum (
  'task',
  'assignment',
  'midterm',
  'final',
  'registration',
  'class',
  'custom'
);

create type public.academic_item_status as enum ('open', 'done', 'cancelled');

create type public.resource_kind as enum ('link', 'note', 'file');

-- --------------------------------------------------------------------------
-- Profiles
-- --------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- The client never creates a profile; the trigger does, atomically with signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------------
-- Academic context (CAP-ONBOARD-001 / CAP-ONBOARD-002)
-- --------------------------------------------------------------------------

create table public.user_academic_contexts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  institution_id    uuid references public.institutions (id) on delete set null,
  academic_unit_id  uuid references public.academic_units (id) on delete set null,
  program_id        uuid references public.programs (id) on delete set null,
  curriculum_id     uuid references public.curricula (id) on delete set null,
  -- Set when Campus does not have the student's plan yet. The gap is recorded,
  -- never invented around (CAP-ONBOARD-002, P-05).
  unmapped_label    text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- A context must resolve to a real plan OR declare itself unmapped.
  constraint user_academic_contexts_resolvable
    check (curriculum_id is not null or unmapped_label is not null)
);

create index user_academic_contexts_user_id_idx on public.user_academic_contexts (user_id);

-- At most one active context per user, enforced by the database rather than hope.
create unique index user_academic_contexts_one_active_idx
  on public.user_academic_contexts (user_id)
  where is_active;

create trigger user_academic_contexts_touch_updated_at
  before update on public.user_academic_contexts
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- Subject states
-- --------------------------------------------------------------------------

-- Only EXPLICIT statuses are stored. `available`, `pending` and `blocked` are
-- derived by src/domain/availability.ts — storing them would let the database
-- drift out of sync with the prerequisite graph.
create table public.user_subject_states (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  curriculum_subject_id  uuid not null references public.curriculum_subjects (id) on delete cascade,
  status                 public.subject_status not null,
  grade                  numeric(4, 2) check (grade is null or (grade >= 0 and grade <= 10)),
  started_at             date,
  completed_at           date,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, curriculum_subject_id)
);

create index user_subject_states_user_id_idx on public.user_subject_states (user_id);
create index user_subject_states_curriculum_subject_id_idx
  on public.user_subject_states (curriculum_subject_id);

create trigger user_subject_states_touch_updated_at
  before update on public.user_subject_states
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- Academic items (CAP-CAPTURE-001 / CAP-CALENDAR-001)
-- --------------------------------------------------------------------------

create table public.academic_items (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  curriculum_subject_id  uuid references public.curriculum_subjects (id) on delete set null,
  kind                   public.academic_item_kind not null default 'task',
  title                  text not null check (length(btrim(title)) between 1 and 200),
  starts_at              timestamptz,
  due_at                 timestamptz,
  status                 public.academic_item_status not null default 'open',
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index academic_items_user_id_idx on public.academic_items (user_id);
create index academic_items_due_at_idx on public.academic_items (user_id, due_at)
  where status = 'open';
create index academic_items_curriculum_subject_id_idx
  on public.academic_items (curriculum_subject_id);

create trigger academic_items_touch_updated_at
  before update on public.academic_items
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- Resources (CAP-RESOURCE-001)
-- --------------------------------------------------------------------------

-- Resources start as links and notes. `storage_path` exists in the schema but the
-- POC does not offer upload until owner/size/content-type validation is proven.
create table public.resources (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  curriculum_subject_id  uuid references public.curriculum_subjects (id) on delete set null,
  kind                   public.resource_kind not null default 'link',
  title                  text not null check (length(btrim(title)) between 1 and 200),
  url                    text,
  storage_path           text,
  body                   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- A resource has to actually carry something.
  constraint resources_has_payload check (
    (kind = 'link' and url is not null)
    or (kind = 'note' and body is not null)
    or (kind = 'file' and storage_path is not null)
  )
);

create index resources_user_id_idx on public.resources (user_id);
create index resources_curriculum_subject_id_idx on public.resources (curriculum_subject_id);

create trigger resources_touch_updated_at
  before update on public.resources
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- RLS — user-owned tier
-- --------------------------------------------------------------------------

alter table public.profiles               enable row level security;
alter table public.user_academic_contexts enable row level security;
alter table public.user_subject_states    enable row level security;
alter table public.academic_items         enable row level security;
alter table public.resources              enable row level security;

-- profiles keys on `id`, not `user_id`.
create policy "own profile readable"   on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy "own profile insertable" on public.profiles for insert to authenticated
  with check (auth.uid() = id);
create policy "own profile updatable"  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "own contexts readable"   on public.user_academic_contexts for select to authenticated
  using (auth.uid() = user_id);
create policy "own contexts insertable" on public.user_academic_contexts for insert to authenticated
  with check (auth.uid() = user_id);
create policy "own contexts updatable"  on public.user_academic_contexts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own contexts deletable"  on public.user_academic_contexts for delete to authenticated
  using (auth.uid() = user_id);

create policy "own states readable"   on public.user_subject_states for select to authenticated
  using (auth.uid() = user_id);
create policy "own states insertable" on public.user_subject_states for insert to authenticated
  with check (auth.uid() = user_id);
create policy "own states updatable"  on public.user_subject_states for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own states deletable"  on public.user_subject_states for delete to authenticated
  using (auth.uid() = user_id);

create policy "own items readable"   on public.academic_items for select to authenticated
  using (auth.uid() = user_id);
create policy "own items insertable" on public.academic_items for insert to authenticated
  with check (auth.uid() = user_id);
create policy "own items updatable"  on public.academic_items for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own items deletable"  on public.academic_items for delete to authenticated
  using (auth.uid() = user_id);

create policy "own resources readable"   on public.resources for select to authenticated
  using (auth.uid() = user_id);
create policy "own resources insertable" on public.resources for insert to authenticated
  with check (auth.uid() = user_id);
create policy "own resources updatable"  on public.resources for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own resources deletable"  on public.resources for delete to authenticated
  using (auth.uid() = user_id);
