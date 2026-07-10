-- ============================================================
-- Multi-agent / Teams — Phase 5: conversation assignment history
-- ============================================================
-- Tracks every assignment change on a conversation (who assigned it to
-- whom, and who made that change) — so if a manager assigns to someone
-- and that person delegates it further, the whole chain is visible.
--
-- Purely additive: new table only, nothing existing is touched.
-- Safe to re-run.
-- ============================================================

create table if not exists chat_assignment_log (
  id           uuid primary key default gen_random_uuid(),
  chat_id      uuid not null references chats(id) on delete cascade,
  assigned_to  uuid references auth.users(id),   -- null = unassigned
  assigned_by  uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists idx_chat_assignment_log_chat_id on chat_assignment_log(chat_id);

alter table chat_assignment_log enable row level security;

drop policy if exists "chat_assignment_log_project_access" on chat_assignment_log;
create policy "chat_assignment_log_project_access"
  on chat_assignment_log for all
  using (
    exists (
      select 1 from chats
      join projects on projects.id = chats.project_id
      where chats.id = chat_assignment_log.chat_id
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
      select 1 from chats
      join projects on projects.id = chats.project_id
      where chats.id = chat_assignment_log.chat_id
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
