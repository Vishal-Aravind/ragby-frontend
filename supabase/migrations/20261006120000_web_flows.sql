-- Website Flows: a visual bot for the embeddable widget, separate from the
-- WhatsApp flow. Safe to re-run.
--
-- BEFORE RUNNING, check no project has two active flows (the unique index
-- below is skipped, with a notice, if any do):
--   select project_id, count(*) from flows where is_active group by 1 having count(*) > 1;

-- ------------------------------------------------------------
-- 1. flows: channel + website settings
-- ------------------------------------------------------------
-- Existing flows become 'whatsapp' through the default, so nothing about the
-- live WhatsApp bot changes.
alter table flows add column if not exists channel text not null default 'whatsapp';
alter table flows drop constraint if exists flows_channel_check;
alter table flows add constraint flows_channel_check check (channel in ('whatsapp', 'web'));

-- Auto-open triggers, start-on-open, teaser text (website flows only).
alter table flows add column if not exists web_settings jsonb not null default '{}'::jsonb;
alter table flows drop constraint if exists flows_web_settings_size;
alter table flows add constraint flows_web_settings_size check (pg_column_size(web_settings) < 16384);

create index if not exists flows_project_channel_active_idx
  on flows (project_id, channel) where is_active;

-- One active flow per (project, channel). Not forced if duplicates already
-- exist: silently deactivating one would change which WhatsApp bot is live.
do $$
begin
  if exists (
    select 1 from flows where is_active group by project_id, channel having count(*) > 1
  ) then
    raise notice 'flows_one_active_per_channel NOT created: some project has two active flows';
  else
    create unique index if not exists flows_one_active_per_channel
      on flows (project_id, channel) where is_active;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. set_flow_active: one active flow per channel, not per project
-- ------------------------------------------------------------
-- Same signature, so the existing route keeps working. Activating a website
-- flow must not switch off the WhatsApp bot, and vice versa.
create or replace function set_flow_active(p_flow_id uuid, p_active boolean)
returns void
language plpgsql
as $$
declare
  v_project_id uuid;
  v_channel text;
begin
  select project_id, channel into v_project_id, v_channel
  from flows where id = p_flow_id
  for update;

  if v_project_id is null then
    raise exception 'flow_not_found';
  end if;

  if p_active then
    update flows set is_active = false
    where project_id = v_project_id and channel = v_channel
      and id <> p_flow_id and is_active;
  end if;

  update flows set is_active = p_active where id = p_flow_id;
end;
$$;
revoke all on function set_flow_active(uuid, boolean) from public, anon;
grant execute on function set_flow_active(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- 3. web_flow_sessions: where a website visitor is in the flow
-- ------------------------------------------------------------
-- Keyed by the widget's sessionId, which becomes chats.id once the visitor
-- actually interacts (no FK: an auto-opened, never-touched session must not
-- create a chats row and clutter the inbox).
create table if not exists web_flow_sessions (
  chat_id            uuid primary key,
  project_id         uuid not null references projects(id) on delete cascade,
  visitor_id         text check (char_length(visitor_id) <= 64),
  flow_id            uuid references flows(id) on delete set null,
  current_node_id    uuid,
  mode               text not null default 'flow' check (mode in ('flow', 'ai', 'human', 'ended')),
  awaiting           jsonb,
  variables          jsonb not null default '{}'::jsonb,
  seq                integer not null default 0,
  resume_at          timestamptz,
  pending_transcript jsonb not null default '[]'::jsonb,
  chat_materialized  boolean not null default false,
  lead_id            uuid,
  started_via        text,
  last_agent_msg_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  expires_at         timestamptz not null
);
alter table web_flow_sessions drop constraint if exists web_flow_sessions_vars_size;
alter table web_flow_sessions add constraint web_flow_sessions_vars_size check (pg_column_size(variables) < 32768);
alter table web_flow_sessions drop constraint if exists web_flow_sessions_tx_size;
alter table web_flow_sessions add constraint web_flow_sessions_tx_size check (pg_column_size(pending_transcript) < 32768);
create index if not exists web_flow_sessions_visitor_idx on web_flow_sessions (project_id, visitor_id);
create index if not exists web_flow_sessions_expiry_idx on web_flow_sessions (expires_at);
create index if not exists web_flow_sessions_human_idx on web_flow_sessions (project_id) where mode = 'human';

alter table web_flow_sessions enable row level security;
drop policy if exists web_flow_sessions_member_read on web_flow_sessions;
create policy web_flow_sessions_member_read on web_flow_sessions for select
  using (is_project_owner_or_active_member(auth.uid(), project_id));
-- Writes: backend (service role) and the takeover/handback routes (admin client) only.

-- ------------------------------------------------------------
-- 4. leads: answers beyond name / email / phone
-- ------------------------------------------------------------
alter table leads add column if not exists custom_fields jsonb not null default '{}'::jsonb;
alter table leads drop constraint if exists leads_custom_fields_size;
alter table leads add constraint leads_custom_fields_size check (pg_column_size(custom_fields) < 16384);

-- ------------------------------------------------------------
-- 5. web_flow_events: per-node analytics (drop-off)
-- ------------------------------------------------------------
create table if not exists web_flow_events (
  id         bigserial primary key,
  project_id uuid not null references projects(id) on delete cascade,
  flow_id    uuid references flows(id) on delete cascade,
  node_id    uuid,
  chat_id    uuid,
  event      text not null,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists web_flow_events_flow_idx on web_flow_events (flow_id, created_at);
alter table web_flow_events enable row level security;
drop policy if exists web_flow_events_member_read on web_flow_events;
create policy web_flow_events_member_read on web_flow_events for select
  using (is_project_owner_or_active_member(auth.uid(), project_id));

-- entered = sessions that reached the node; completed = sessions that then
-- answered it (choice/submit) or passed through; dropped = entered - completed.
create or replace function web_flow_node_stats(p_flow_id uuid, p_since timestamptz)
returns table(node_id uuid, entered bigint, completed bigint, dropped bigint)
language sql
stable
as $$
  with e as (
    select node_id, chat_id, event from web_flow_events
    where flow_id = p_flow_id and created_at >= p_since and node_id is not null
  ),
  entered as (
    select node_id, count(distinct chat_id) n from e where event = 'enter' group by node_id
  ),
  completed as (
    select node_id, count(distinct chat_id) n from e
    where event in ('choice', 'submit', 'pass') group by node_id
  )
  select en.node_id, en.n, coalesce(c.n, 0), greatest(en.n - coalesce(c.n, 0), 0)
  from entered en left join completed c on c.node_id = en.node_id;
$$;
revoke all on function web_flow_node_stats(uuid, timestamptz) from public, anon;
grant execute on function web_flow_node_stats(uuid, timestamptz) to authenticated;
