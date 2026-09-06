-- ============================================================
-- RLS for `files`, plus storage policies for the `documents` bucket
-- ============================================================
-- The lockdown migration (20260824120000) enumerated every table reached
-- by a non-service-role client and split them into Group A (zero-policy)
-- and Group B (project-scoped policy). `files` was missed by both, despite
-- being queried through the session-bound anon client in:
--   src/app/api/files/route.js
--   src/app/api/files/[fileId]/route.js
--   src/app/api/files/upload/route.js
-- With RLS off, the anon key — which ships in the site's own JS bundle —
-- allows reading every tenant's filenames and storage_paths, and issuing
-- direct DELETE/INSERT against the table. It also holds user-authored FAQ
-- content written by backend/content_gaps.py, not just uploaded filenames.
--
-- `files` belongs in Group B: it IS read via the anon client, so a
-- zero-policy lockdown would break the Documents tab. Uses the exact
-- owner-or-active-member template already proven on chats/flows.
--
-- Safe to re-run.
-- ============================================================

alter table files enable row level security;
drop policy if exists "files_project_access" on files;
create policy "files_project_access"
  on files for all
  using (
    exists (
      select 1 from projects
      where projects.id = files.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from projects
      where projects.id = files.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );


-- ------------------------------------------------------------
-- storage.objects policies for the `documents` bucket
-- ------------------------------------------------------------
-- No migration had ever configured storage policies; the ones that existed
-- were created by hand in the dashboard and never reviewed. Confirmed live
-- via pg_policies: four "full policy flreew_*" policies granted SELECT,
-- INSERT, UPDATE and DELETE across the entire documents bucket with
-- `bucket_id = 'documents'` as their only condition, to role `public` —
-- which in Postgres means every role including anon. Since the anon key
-- ships in the site's own JS bundle, any visitor could read or delete every
-- tenant's uploaded documents without logging in.
--
-- Objects are keyed `<projectId>/<filename>`, so the first path segment is
-- the project id and access follows project membership. Note this relies
-- on the key never containing traversal segments — the upload route now
-- sanitizes filenames to a bare basename before building the key.

-- These were granting SELECT/UPDATE/DELETE across the WHOLE documents
-- bucket with no ownership condition, i.e. any user could read or delete
-- every other tenant's uploaded files. Adding a scoped policy alongside
-- them would have changed nothing, because Postgres combines policies with
-- OR — they have to go.
drop policy if exists "full policy flreew_0" on storage.objects;
drop policy if exists "full policy flreew_1" on storage.objects;
drop policy if exists "full policy flreew_2" on storage.objects;
drop policy if exists "full policy flreew_3" on storage.objects;

update storage.buckets set public = false where id = 'documents';

drop policy if exists "documents_project_access" on storage.objects;
create policy "documents_project_access"
  on storage.objects for all
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from projects
      where projects.id::text = (storage.foldername(storage.objects.name))[1]
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from projects
      where projects.id::text = (storage.foldername(storage.objects.name))[1]
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );
