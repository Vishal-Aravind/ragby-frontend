-- ============================================================
-- Fix "Database error deleting user" — foreign keys blocking
-- auth.users deletion with no cleanup rule
-- ============================================================
-- Confirmed live (Supabase Postgres logs) two exact blockers:
--   chats_assigned_to_fkey on chats
--   project_members_invited_by_fkey on project_members
--
-- Same underlying issue as the earlier flows/whatsapp_sessions fix: these
-- foreign keys have no ON DELETE rule, so Postgres refuses to delete a
-- user who's ever been referenced anywhere. Both of these are pure
-- attribution columns (who a chat happens to be assigned to, who
-- happened to invite someone) — the CHAT and the MEMBERSHIP are still
-- perfectly meaningful without that person; only the "who" needs to
-- clear. SET NULL, not CASCADE — deleting a staff account must never
-- delete real customer conversations or team memberships.
--
-- Proactively applying the same fix to the other attribution-style
-- columns in the schema (author/assigned/resolved-by), so this doesn't
-- need another round trip the next time a different test account with a
-- different history gets deleted. project_members.user_id is different
-- in kind — that row's entire meaning IS the membership, so it cascades.
--
-- Safe to re-run.
-- ============================================================

-- SET NULL only works going forward if the column can actually hold null
-- — safe/idempotent either way, a no-op on any column that's already
-- nullable, only relaxes (never tightens) on ones that aren't.
alter table chats alter column assigned_to drop not null;
alter table project_members alter column invited_by drop not null;
alter table chat_assignment_log alter column assigned_by drop not null;
alter table chat_assignment_log alter column assigned_to drop not null;
alter table chat_notes alter column author_id drop not null;
alter table content_gap_resolutions alter column resolved_by drop not null;
alter table files alter column user_id drop not null;

alter table chats drop constraint if exists chats_assigned_to_fkey;
alter table chats add constraint chats_assigned_to_fkey
  foreign key (assigned_to) references auth.users(id) on delete set null;

alter table project_members drop constraint if exists project_members_invited_by_fkey;
alter table project_members add constraint project_members_invited_by_fkey
  foreign key (invited_by) references auth.users(id) on delete set null;

alter table chat_assignment_log drop constraint if exists chat_assignment_log_assigned_by_fkey;
alter table chat_assignment_log add constraint chat_assignment_log_assigned_by_fkey
  foreign key (assigned_by) references auth.users(id) on delete set null;

alter table chat_assignment_log drop constraint if exists chat_assignment_log_assigned_to_fkey;
alter table chat_assignment_log add constraint chat_assignment_log_assigned_to_fkey
  foreign key (assigned_to) references auth.users(id) on delete set null;

alter table chat_notes drop constraint if exists chat_notes_author_id_fkey;
alter table chat_notes add constraint chat_notes_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

alter table content_gap_resolutions drop constraint if exists content_gap_resolutions_resolved_by_fkey;
alter table content_gap_resolutions add constraint content_gap_resolutions_resolved_by_fkey
  foreign key (resolved_by) references auth.users(id) on delete set null;

alter table files drop constraint if exists files_user_id_fkey;
alter table files add constraint files_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- Different in kind from the above — this row's entire meaning IS the
-- membership itself, which has no meaning without the member.
alter table project_members drop constraint if exists project_members_user_id_fkey;
alter table project_members add constraint project_members_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
