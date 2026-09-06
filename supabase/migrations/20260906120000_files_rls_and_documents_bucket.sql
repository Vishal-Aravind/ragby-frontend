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
-- No migration has ever configured storage policies, yet uploads and
-- deletes go through the anon session client with the guessable key
-- `<projectId>/<filename>`. Whether one tenant could read another's PDF
-- depended entirely on undocumented dashboard configuration, so a fresh
-- environment shipped wide open.
--
-- Objects are keyed `<projectId>/<filename>`, so the first path segment is
-- the project id and access follows project membership. Note this relies
-- on the key never containing traversal segments — the upload route now
-- sanitizes filenames to a bare basename before building the key.

update storage.buckets set public = false where id = 'documents';

drop policy if exists "documents_project_access" on storage.objects;
create policy "documents_project_access"
  on storage.objects for all
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from projects
      where projects.id::text = (storage.foldername(name))[1]
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
      where projects.id::text = (storage.foldername(name))[1]
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
