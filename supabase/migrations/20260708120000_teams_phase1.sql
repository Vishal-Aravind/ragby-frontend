-- ============================================================
-- Multi-agent / Teams — Phase 1: schema only (no UI yet)
-- ============================================================
-- Run this once in the Supabase Dashboard → SQL Editor, or via
-- `supabase db push` if you link the CLI to this project.
--
-- Safe to re-run: tables/columns/indexes use IF NOT EXISTS, and
-- policies are dropped-then-recreated so re-running won't error.
--
-- What this does:
--   1. project_members  — team membership + role per project
--   2. chats.assigned_to — which agent is handling a conversation
--   3. chat_notes        — internal notes, never sent to the customer
--
-- `projects.user_id` keeps meaning "owner" exactly as it does today.
-- Existing projects are untouched — they simply have zero rows in
-- project_members, which already correctly means "no team yet."
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Team membership
-- ------------------------------------------------------------
create table if not exists project_members (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  email        text not null,
  role         text not null check (role in ('admin', 'agent')),
  status       text not null default 'pending' check (status in ('pending', 'active')),
  invited_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  unique (project_id, email)
);

create index if not exists idx_project_members_project_id on project_members(project_id);
create index if not exists idx_project_members_user_id    on project_members(user_id);

alter table project_members enable row level security;

drop policy if exists "project_members_owner_all" on project_members;
create policy "project_members_owner_all"
  on project_members for all
  using (
    exists (select 1 from projects where projects.id = project_members.project_id and projects.user_id = auth.uid())
  )
  with check (
    exists (select 1 from projects where projects.id = project_members.project_id and projects.user_id = auth.uid())
  );

drop policy if exists "project_members_admin_all" on project_members;
create policy "project_members_admin_all"
  on project_members for all
  using (
    exists (
      select 1 from project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
        and pm.role = 'admin'
        and pm.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
        and pm.role = 'admin'
        and pm.status = 'active'
    )
  );

drop policy if exists "project_members_self_select" on project_members;
create policy "project_members_self_select"
  on project_members for select
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 2. Conversation assignment
-- ------------------------------------------------------------
alter table chats add column if not exists assigned_to uuid references auth.users(id);

-- ------------------------------------------------------------
-- 3. Internal notes (never shown to the customer)
-- ------------------------------------------------------------
create table if not exists chat_notes (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references chats(id) on delete cascade,
  author_id   uuid not null references auth.users(id),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_chat_notes_chat_id on chat_notes(chat_id);

alter table chat_notes enable row level security;

drop policy if exists "chat_notes_project_access" on chat_notes;
create policy "chat_notes_project_access"
  on chat_notes for all
  using (
    exists (
      select 1 from chats
      join projects on projects.id = chats.project_id
      where chats.id = chat_notes.chat_id
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
      where chats.id = chat_notes.chat_id
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