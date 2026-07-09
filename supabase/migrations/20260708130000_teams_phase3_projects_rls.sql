-- ============================================================
-- Multi-agent / Teams — Phase 3: let team members read the project
-- ============================================================
-- Purely additive: adds a second SELECT policy to `projects` so an
-- active team member can also read the project they were invited to,
-- without touching whatever owner-only policy already exists.
-- Postgres combines multiple permissive policies for the same command
-- with OR, so this can't reduce access — it only adds a new way in.
--
-- Safe to re-run.
-- ============================================================

drop policy if exists "projects_member_select" on projects;
create policy "projects_member_select"
  on projects for select
  using (
    exists (
      select 1 from project_members pm
      where pm.project_id = projects.id
        and pm.user_id = auth.uid()
        and pm.status = 'active'
    )
  );