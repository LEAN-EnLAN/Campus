-- Campus — explicit privileges for the PostgREST roles.
--
-- RLS decides WHICH ROWS a role may touch. It does not grant the underlying table
-- privilege: a table with perfect policies and no GRANT still answers
-- "permission denied". This project's tables are created by `postgres` in
-- migrations and do not inherit DML grants, so we state them here rather than
-- relying on default privileges we do not control.
--
-- Defence in depth for the reference tier: it gets SELECT only, so even if a
-- write policy were added by mistake later, there is no privilege to exercise.

grant usage on schema public to anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- Reference tier — read-only, no write privilege at all
-- --------------------------------------------------------------------------

grant select on table
  public.institutions,
  public.academic_units,
  public.programs,
  public.curricula,
  public.subjects,
  public.curriculum_subjects,
  public.prerequisites
to anon, authenticated;

-- --------------------------------------------------------------------------
-- User-owned tier — full DML, filtered row-by-row by RLS
-- --------------------------------------------------------------------------

grant select, insert, update, delete on table
  public.profiles,
  public.user_academic_contexts,
  public.user_subject_states,
  public.academic_items,
  public.resources
to authenticated;

-- `anon` deliberately receives nothing on the user-owned tier: an unauthenticated
-- client has no business reaching these tables even to be filtered to zero rows.

-- --------------------------------------------------------------------------
-- service_role — server-side only (seeding, tests, admin). Bypasses RLS.
-- --------------------------------------------------------------------------

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Keep future tables consistent so a new migration cannot silently ship a table
-- that PostgREST cannot read.
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
