-- Campus — account, privacy and metrics (Release A, WP2).
--
-- Four things, all opt-in or owner-only:
--   1. metrics consent on the profile (off by default);
--   2. `product_events`: anonymous-content counters, insertable only with consent;
--   3. `feedback`: free text the student chose to send us;
--   4. `delete_my_account()` and two service-role-only aggregate functions.
--
-- Privileges are stated explicitly, as in `20260814000300_grants.sql`. The two
-- new tables are WRITE-ONLY for the client: RLS has no select policy AND the
-- role has no select privilege, so nothing a student sends can be read back
-- from a browser — theirs or anyone else's.

-- --------------------------------------------------------------------------
-- 1. Consent on the profile. The existing "own profile updatable" policy
--    already lets a student change their own row.
-- --------------------------------------------------------------------------

alter table public.profiles
  add column metrics_consent    boolean not null default false,
  add column metrics_consent_at timestamptz;

-- The signup checkbox. Consent is written by the same trigger that creates the
-- profile, from the signup metadata, so it holds even when the account needs
-- email confirmation first (no session yet, so the client could not write it)
-- and it adds no step between "Crear cuenta" and Hoy. Only the literal JSON
-- `true` counts; anything else, or nothing, is "no".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  consent boolean := coalesce(new.raw_user_meta_data -> 'metrics_consent' = 'true'::jsonb, false);
begin
  insert into public.profiles (id, display_name, metrics_consent, metrics_consent_at)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    consent,
    case when consent then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- 2. Product events — counts of clicks, never content.
-- --------------------------------------------------------------------------

create table public.product_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (name in ('share_copied', 'share_saved')),
  -- A random per-share token, so a copy and the save it led to can be paired
  -- without identifying who received it.
  ref        text check (ref ~ '^[A-Za-z0-9_-]{8,32}$'),
  created_at timestamptz not null default now()
);

create index product_events_user_id_idx on public.product_events (user_id);
create index product_events_created_at_idx on public.product_events (created_at);

alter table public.product_events enable row level security;

-- The only policy. Consent is checked by the database, not trusted from the
-- client: switching it off in Ajustes rejects the very next insert.
create policy "own events insertable with consent" on public.product_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.metrics_consent
    )
  );

-- --------------------------------------------------------------------------
-- 3. Feedback — "Contanos algo".
-- --------------------------------------------------------------------------

create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null check (length(btrim(body)) between 1 and 2000),
  route       text check (length(route) <= 500),
  app_version text check (length(app_version) <= 50),
  created_at  timestamptz not null default now()
);

create index feedback_user_id_idx on public.feedback (user_id);

alter table public.feedback enable row level security;

create policy "own feedback insertable" on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- Privileges for the two write-only tables.
--
-- Supabase's default privileges hand new tables ALL to anon and authenticated;
-- take that back first so "insert only" is literally true.
-- --------------------------------------------------------------------------

revoke all on table public.product_events, public.feedback from public, anon, authenticated;
grant insert on table public.product_events, public.feedback to authenticated;
grant all on table public.product_events, public.feedback to service_role;

-- --------------------------------------------------------------------------
-- 4a. Delete my account. Every user table cascades from auth.users.
-- --------------------------------------------------------------------------

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'delete_my_account requires a signed-in user'
      using errcode = '42501';
  end if;
  delete from auth.users where id = caller;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- --------------------------------------------------------------------------
-- 4b. Aggregate metrics — service role ONLY.
--
-- Postgres grants EXECUTE to PUBLIC on every new function, and Supabase adds
-- anon/authenticated through default privileges. Without the revokes below,
-- any signed-in student could read these numbers.
-- --------------------------------------------------------------------------

-- Distinct people who touched their academic data in the last 7 days.
create function public.weekly_activity()
returns table (active_users bigint, item_users bigint, subject_state_users bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with since as (select now() - interval '7 days' as at),
  item_users as (
    select distinct i.user_id
    from public.academic_items i, since
    where i.created_at >= since.at or i.updated_at >= since.at
  ),
  state_users as (
    select distinct s.user_id
    from public.user_subject_states s, since
    where s.created_at >= since.at or s.updated_at >= since.at
  )
  select
    (select count(*) from (select user_id from item_users union select user_id from state_users) u),
    (select count(*) from item_users),
    (select count(*) from state_users);
$$;

-- The activation funnel since a date:
--   signups           profiles created since `since`
--   onboarded         distinct people who saved an academic context since `since`
--   with_item         distinct people who created at least one item since `since`
--   active_this_week  distinct people with items created or updated in the last 7 days
create function public.funnel_counts(since timestamptz)
returns table (signups bigint, onboarded bigint, with_item bigint, active_this_week bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.profiles p where p.created_at >= since),
    (select count(distinct c.user_id) from public.user_academic_contexts c
      where c.created_at >= since),
    (select count(distinct i.user_id) from public.academic_items i
      where i.created_at >= since),
    (select count(distinct i.user_id) from public.academic_items i
      where i.created_at >= now() - interval '7 days'
         or i.updated_at >= now() - interval '7 days');
$$;

revoke execute on function public.weekly_activity() from public, anon, authenticated;
revoke execute on function public.funnel_counts(timestamptz) from public, anon, authenticated;
grant execute on function public.weekly_activity() to service_role;
grant execute on function public.funnel_counts(timestamptz) to service_role;
