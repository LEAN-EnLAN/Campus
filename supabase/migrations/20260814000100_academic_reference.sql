-- Campus — academic reference data.
--
-- This tier is curated project data seeded from official university sources.
-- Any authenticated user may read it. Nobody may write it from the client:
-- there is deliberately no insert/update/delete policy on these tables, so
-- PostgREST refuses every write even though RLS is enabled.
--
-- See .claude/skills/campus-academic-data/SKILL.md

-- `gen_random_uuid()` is core since PG13, so pgcrypto is not needed.
-- `unaccent` goes in the `extensions` schema, which is Supabase convention and
-- keeps `public` holding only our own objects.
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------

create type public.academic_unit_kind as enum (
  'faculty',
  'regional_faculty',
  'school',
  'department',
  'institute'
);

-- Argentine degrees are cuatrimestral or anual. No semesters, no quarters.
create type public.academic_term as enum ('anual', '1c', '2c');

create type public.prerequisite_kind as enum ('to_take', 'to_pass', 'recommended');

-- --------------------------------------------------------------------------
-- Helpers
-- --------------------------------------------------------------------------

-- Accent- and case-insensitive normalisation, mirroring src/domain/search.ts.
create or replace function public.normalize_academic_name(value text)
returns text
language sql
immutable
strict
set search_path = public, extensions, pg_temp
as $$
  select regexp_replace(lower(extensions.unaccent(value)), '\s+', ' ', 'g');
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- Institution → AcademicUnit → Program → Curriculum → CurriculumSubject
-- --------------------------------------------------------------------------

create table public.institutions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  short_name  text not null,
  country     text not null default 'AR',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Recursive on purpose: UTN has regionales, UNR has facultades, and a unit can
-- have departamentos underneath. One model, no institution-specific branches.
create table public.academic_units (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions (id) on delete cascade,
  parent_id       uuid references public.academic_units (id) on delete cascade,
  kind            public.academic_unit_kind not null,
  name            text not null,
  slug            text not null,
  created_at      timestamptz not null default now(),
  unique (institution_id, slug),
  constraint academic_units_no_self_parent check (parent_id is null or parent_id <> id)
);

create index academic_units_institution_id_idx on public.academic_units (institution_id);
create index academic_units_parent_id_idx on public.academic_units (parent_id);

create table public.programs (
  id                uuid primary key default gen_random_uuid(),
  academic_unit_id  uuid not null references public.academic_units (id) on delete cascade,
  slug              text not null,
  name              text not null,
  degree_type       text not null default 'grado',
  duration_hint     text,
  created_at        timestamptz not null default now(),
  unique (academic_unit_id, slug)
);

create index programs_academic_unit_id_idx on public.programs (academic_unit_id);

-- A program has MANY curricula. Plan versions are never merged (CAP-PLAN-003).
create table public.curricula (
  id                 uuid primary key default gen_random_uuid(),
  program_id         uuid not null references public.programs (id) on delete cascade,
  name               text not null,
  version            text not null,
  valid_from         date,
  valid_to           date,
  -- Provenance is not optional metadata; it is what makes this data trustworthy.
  source_url         text,
  source_kind        text check (source_kind in ('html', 'pdf', 'manual')),
  source_fetched_at  timestamptz,
  is_default         boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (program_id, version)
);

create index curricula_program_id_idx on public.curricula (program_id);

-- A subject is shared across plans; year/term/credits belong to the LINK below.
create table public.subjects (
  id               uuid primary key default gen_random_uuid(),
  code             text,
  name             text not null,
  normalized_name  text not null,
  created_at       timestamptz not null default now()
);

create index subjects_normalized_name_idx on public.subjects (normalized_name);

create table public.curriculum_subjects (
  id             uuid primary key default gen_random_uuid(),
  curriculum_id  uuid not null references public.curricula (id) on delete cascade,
  subject_id     uuid not null references public.subjects (id) on delete restrict,
  year_level     smallint not null check (year_level between 1 and 8),
  term           public.academic_term not null,
  credits        numeric(6, 2),
  elective       boolean not null default false,
  display_order  smallint not null default 0,
  created_at     timestamptz not null default now(),
  -- NOT unique on (curriculum_id, subject_id): a real plan can list the same slot
  -- twice. UNR FCEIA's Licenciatura en Ciencias de la Computación has two separate
  -- "Horas electivas" blocks in 5° año, one per cuatrimestre. `display_order` is
  -- what distinguishes two occurrences of the same subject within one plan.
  unique (curriculum_id, subject_id, display_order)
);

create index curriculum_subjects_curriculum_id_idx on public.curriculum_subjects (curriculum_id);
create index curriculum_subjects_subject_id_idx on public.curriculum_subjects (subject_id);

-- Prerequisites live between curriculum_subjects, not bare subjects: the same
-- pair of materias can have different correlativas in different plan versions.
create table public.prerequisites (
  id                             uuid primary key default gen_random_uuid(),
  curriculum_subject_id          uuid not null references public.curriculum_subjects (id) on delete cascade,
  required_curriculum_subject_id uuid not null references public.curriculum_subjects (id) on delete cascade,
  kind                           public.prerequisite_kind not null,
  created_at                     timestamptz not null default now(),
  unique (curriculum_subject_id, required_curriculum_subject_id, kind),
  constraint prerequisites_no_self_reference
    check (curriculum_subject_id <> required_curriculum_subject_id)
);

create index prerequisites_curriculum_subject_id_idx
  on public.prerequisites (curriculum_subject_id);
create index prerequisites_required_idx
  on public.prerequisites (required_curriculum_subject_id);

-- --------------------------------------------------------------------------
-- RLS — read-only reference tier
-- --------------------------------------------------------------------------

alter table public.institutions        enable row level security;
alter table public.academic_units      enable row level security;
alter table public.programs            enable row level security;
alter table public.curricula           enable row level security;
alter table public.subjects            enable row level security;
alter table public.curriculum_subjects enable row level security;
alter table public.prerequisites       enable row level security;

create policy "reference readable by authenticated"
  on public.institutions for select to authenticated using (true);
create policy "reference readable by authenticated"
  on public.academic_units for select to authenticated using (true);
create policy "reference readable by authenticated"
  on public.programs for select to authenticated using (true);
create policy "reference readable by authenticated"
  on public.curricula for select to authenticated using (true);
create policy "reference readable by authenticated"
  on public.subjects for select to authenticated using (true);
create policy "reference readable by authenticated"
  on public.curriculum_subjects for select to authenticated using (true);
create policy "reference readable by authenticated"
  on public.prerequisites for select to authenticated using (true);

-- Onboarding needs the institution list before a session exists in some flows.
create policy "institutions readable by anon"
  on public.institutions for select to anon using (true);
create policy "academic units readable by anon"
  on public.academic_units for select to anon using (true);
create policy "programs readable by anon"
  on public.programs for select to anon using (true);
create policy "curricula readable by anon"
  on public.curricula for select to anon using (true);
