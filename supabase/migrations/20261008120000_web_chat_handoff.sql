-- One inbox for website chats: a person can step into ANY website chat (not
-- only website-flow chats), and lead capture gets a "when to ask" choice.
-- Safe to re-run.

-- A team member has taken over (or the visitor asked for a person): the AI
-- stays quiet on this chat and the widget polls for the team's replies.
alter table chats add column if not exists human_mode boolean not null default false;
alter table chats add column if not exists human_since timestamptz;
alter table chats add column if not exists last_agent_msg_at timestamptz;
-- The widget's durable browser id, so a website chat can be matched to the
-- contact (leads.session_id) it belongs to.
alter table chats add column if not exists visitor_id text;
alter table chats drop constraint if exists chats_visitor_id_len;
alter table chats add constraint chats_visitor_id_len check (visitor_id is null or char_length(visitor_id) <= 64);
create index if not exists chats_human_mode_idx on chats (project_id) where human_mode;

-- When the website asks a visitor for their details:
--   before     - before the first answer
--   after_n    - after N messages (the behaviour so far; existing rows keep it)
--   on_handoff - only when the visitor asks to talk to a person
alter table lead_capture_config add column if not exists mode text not null default 'after_n';
alter table lead_capture_config drop constraint if exists lead_capture_config_mode_check;
alter table lead_capture_config add constraint lead_capture_config_mode_check
  check (mode in ('before', 'after_n', 'on_handoff'));
