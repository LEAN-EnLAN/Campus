-- Campus — material files (CAP-RESOURCE-001).
--
-- Until now a resource was a link or a note; `kind = 'file'` existed in the enum
-- but nothing could create one. This migration proves the four things the
-- storage doctrine asks for before upload ships:
--
--   owner         storage.objects RLS: a user reaches only `<auth.uid()>/...`
--   size          the bucket refuses anything over 20 MB
--   content type  the bucket refuses anything outside the allowlist
--   path          the resource row must point inside its owner's own folder
--
-- The client checks the same limits first (src/domain/material-file.ts) only to
-- explain them; these are the ones that hold.

-- --------------------------------------------------------------------------
-- Bucket — private, 20 MB, PDFs / images / office documents
-- --------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,
  20971520,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- --------------------------------------------------------------------------
-- storage.objects RLS — one folder per user, four separate policies
-- --------------------------------------------------------------------------
-- The first path segment is the owner. `with check` on insert AND update, so an
-- object can neither be written into nor moved into someone else's folder.

create policy "own materials readable" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own materials insertable" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own materials updatable" on storage.objects for update to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own materials deletable" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- --------------------------------------------------------------------------
-- public.resources — file metadata, consistent with kind
-- --------------------------------------------------------------------------

alter table public.resources
  add column mime_type  text,
  add column size_bytes bigint;

-- A file row carries a path inside its owner's folder plus its type and size; a
-- link or a note carries none of the three. (resources_has_payload, from the
-- first migration, still requires storage_path for kind = 'file'.)
alter table public.resources add constraint resources_file_metadata check (
  (
    kind = 'file'
    and storage_path is not null
    and storage_path like user_id::text || '/%'
    and storage_path not like '%..%'
    and mime_type is not null
    and size_bytes between 1 and 20971520
  )
  or (
    kind <> 'file'
    and storage_path is null
    and mime_type is null
    and size_bytes is null
  )
);

-- Table-level DML on public.resources is already granted to `authenticated`
-- (20260814000300_grants.sql) and covers the new columns. Restated for clarity
-- of intent; idempotent.
grant select, insert, update, delete on table public.resources to authenticated;
