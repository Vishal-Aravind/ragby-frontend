-- ============================================================
-- Unanswered Questions report — resolution tracking
-- ============================================================
-- The actual "unanswered questions" list is derived on the fly from
-- existing chat_messages (scanning for the bot's fallback string), so no
-- logging table is needed for that. This table only tracks which question
-- texts the merchant has marked as resolved (either by dismissing it or
-- by answering it, which trains the bot via a new document).
--
-- Safe to re-run.
-- ============================================================

create table if not exists content_gap_resolutions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  question_key text not null,        -- lower(trim(question)) — used to match/group
  resolved_at  timestamptz not null default now(),
  resolved_by  uuid references auth.users(id),
  unique (project_id, question_key)
);

create index if not exists idx_content_gap_resolutions_project_id on content_gap_resolutions(project_id);

alter table content_gap_resolutions enable row level security;

drop policy if exists "content_gap_resolutions_project_access" on content_gap_resolutions;
create policy "content_gap_resolutions_project_access"
  on content_gap_resolutions for all
  using (
    exists (
      select 1 from projects
      where projects.id = content_gap_resolutions.project_id
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
      where projects.id = content_gap_resolutions.project_id
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
