-- ============================================================
-- Fix: RLS policies could not read `projects`
-- ============================================================
-- 20260906120000 added a storage policy for the documents bucket that
-- checks project membership with `exists (select 1 from projects ...)`.
-- That cannot work: the earlier lockdown migration enabled RLS on
-- `projects` with ZERO policies, and Postgres enforces row security on
-- tables referenced inside a policy expression too. So the subquery
-- returned no rows for any normal user, the condition was always false,
-- and every upload to the documents bucket was denied.
--
-- The standard fix is a SECURITY DEFINER function: it runs with the
-- definer's rights, so it can read `projects` regardless of RLS, while
-- still only ever answering one narrow question — "may the CURRENT user
-- reach this project?" It takes text rather than uuid so a malformed
-- storage path returns false instead of raising a cast error.
--
-- Safe to re-run.
-- ============================================================

create or replace function public.user_can_access_project(p_project_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from projects
    where projects.id::text = p_project_id
      and (
        projects.user_id = auth.uid()
        or exists (
          select 1
          from project_members pm
          where pm.project_id = projects.id
            and pm.user_id = auth.uid()
            and pm.status = 'active'
        )
      )
  );
$$;

revoke all on function public.user_can_access_project(text) from public;
grant execute on function public.user_can_access_project(text) to authenticated;


-- Storage: objects are keyed `<projectId>/<filename>`, so the first path
-- segment identifies the project.
drop policy if exists "documents_project_access" on storage.objects;
create policy "documents_project_access"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'documents'
    and public.user_can_access_project((storage.foldername(storage.objects.name))[1])
  )
  with check (
    bucket_id = 'documents'
    and public.user_can_access_project((storage.foldername(storage.objects.name))[1])
  );


-- The files policy has the same flaw. It happens to be masked today by a
-- pre-existing `users_manage_own_files` policy (uploader-scoped, created
-- outside version control), which is why inserts still worked — but on its
-- own terms this policy never matched, so teammates could not see each
-- other's documents as intended.
drop policy if exists "files_project_access" on files;
create policy "files_project_access"
  on files for all
  to authenticated
  using (public.user_can_access_project(files.project_id::text))
  with check (public.user_can_access_project(files.project_id::text));
