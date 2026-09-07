-- ============================================================
-- Leads: dedupe, then enforce uniqueness
-- ============================================================
-- `leads` and `lead_capture_config` were created in the dashboard rather than
-- by a migration, so neither ever got a unique constraint. Every dedup check
-- in the codebase is therefore a select-then-insert race:
--
--   * leads.py submit_lead      — two concurrent widget submits both see
--                                 nothing and both insert.
--   * leads.py upsert_contact   — driven by whatsapp.py on a webhook META
--                                 RETRIES, so this races in normal operation,
--                                 not just under attack.
--
-- The second one is not cosmetic. chat.py's _get_known_customer_name reads a
-- contact with .maybe_single() on (project_id, phone), and that RAISES when
-- there are two rows — a duplicate contact takes down the WhatsApp chat path
-- for that customer.
--
-- lead_capture_config needs its constraint for a different reason:
-- save_lead_config does .upsert(on_conflict="project_id"), which is only an
-- upsert if that constraint exists. Without it, saving the settings has been
-- appending config rows, and the read then picked an arbitrary one.
--
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Merge duplicate contacts into the row we're about to keep
-- ------------------------------------------------------------
-- Keeper is the OLDEST row per (project_id, phone) — it owns the real
-- created_at. Carry its duplicates' tags and latest last_seen_at over first,
-- so deduping doesn't silently drop a tag someone filtered a campaign on.
with grp as (
  select
    (array_agg(id order by created_at asc, id asc))[1] as keeper_id,
    array_agg(id) as ids
  from leads
  where phone is not null and phone <> ''
  group by project_id, phone
  having count(*) > 1
),
merged as (
  select
    g.keeper_id,
    (select coalesce(array_agg(distinct t), '{}')
       from leads l2, unnest(coalesce(l2.tags, '{}')) as t
      where l2.id = any(g.ids)) as all_tags,
    (select max(l3.last_seen_at)
       from leads l3
      where l3.id = any(g.ids)) as newest_seen
  from grp g
)
update leads
set tags         = merged.all_tags,
    -- GREATEST ignores NULLs in Postgres, so a keeper with no last_seen_at
    -- still picks up its duplicate's.
    last_seen_at = greatest(leads.last_seen_at, merged.newest_seen)
from merged
where leads.id = merged.keeper_id;

-- ------------------------------------------------------------
-- 2. Delete the duplicates
-- ------------------------------------------------------------
delete from leads l
using (
  select id, row_number() over (
    partition by project_id, phone
    order by created_at asc, id asc
  ) as rn
  from leads
  where phone is not null and phone <> ''
) d
where l.id = d.id and d.rn > 1;

delete from leads l
using (
  select id, row_number() over (
    partition by project_id, session_id
    order by created_at asc, id asc
  ) as rn
  from leads
  where session_id is not null and session_id <> ''
) d
where l.id = d.id and d.rn > 1;

-- ------------------------------------------------------------
-- 3. Dedupe lead_capture_config
-- ------------------------------------------------------------
-- Ordered by ctid rather than a timestamp column, because this table's shape
-- isn't defined in any migration and may not have one. For an append-only
-- table the highest ctid is the latest insert, which is the save the operator
-- most recently made — the right one to keep for a settings row.
delete from lead_capture_config c
using (
  select ctid, row_number() over (
    partition by project_id
    order by ctid desc
  ) as rn
  from lead_capture_config
) d
where c.ctid = d.ctid and d.rn > 1;

-- ------------------------------------------------------------
-- 4. The constraints
-- ------------------------------------------------------------
-- Partial indexes: a lead with no phone (web widget) or no session_id
-- (WhatsApp contact) must not collide with every other such lead.
create unique index if not exists leads_project_phone_uniq
  on leads (project_id, phone)
  where phone is not null and phone <> '';

create unique index if not exists leads_project_session_uniq
  on leads (project_id, session_id)
  where session_id is not null and session_id <> '';

-- A real constraint, not just an index: ON CONFLICT in save_lead_config's
-- upsert needs something it can name.
alter table lead_capture_config
  drop constraint if exists lead_capture_config_project_id_key;
alter table lead_capture_config
  add constraint lead_capture_config_project_id_key unique (project_id);

-- ------------------------------------------------------------
-- 5. Supporting index for the lead-capture gate
-- ------------------------------------------------------------
-- chat.py's _lead_capture_blocks counts a session's user messages on every
-- public message once lead capture is on. Without this that count is a
-- sequential scan of chat_messages, on the hot chat path.
create index if not exists chat_messages_chat_role_idx
  on chat_messages (chat_id, role);
