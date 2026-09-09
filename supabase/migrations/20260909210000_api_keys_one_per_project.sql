-- ============================================================
-- API keys: one per project, and a revocation flag that exists
-- ============================================================
-- Two problems, both from the same gap: nothing in the schema said a
-- project has exactly one key.
--
-- 1. get_api_key created a key when none existed — a GET performing a
--    write — with a select-then-insert and no constraint between them. Two
--    concurrent first loads of the tab therefore created TWO rows for one
--    project. That compounded badly: regenerate_api_key updated every row
--    matching project_id, so both ended up sharing one key_hash, which
--    violates the unique index from 20260816120000 and made regeneration
--    fail permanently for that project.
--
-- 2. send_template_api.py has always refused a key whose is_active is
--    false, but NO migration ever created that column, and api_keys.py's
--    own lookup ignored it entirely. Both lookups are now one shared
--    function that honours the flag, so the column has to genuinely exist.
--
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The revocation flag the code already assumed
-- ------------------------------------------------------------
-- Defaults true so every existing key keeps working.
alter table api_keys
  add column if not exists is_active boolean not null default true;

-- ------------------------------------------------------------
-- 2. Collapse any project that ended up with more than one key
-- ------------------------------------------------------------
-- Keeps the most recently used key, falling back to the newest — that is
-- the one an integration is most likely still authenticating with, so
-- keeping it is the choice least likely to break a live caller.
delete from api_keys a
using (
  select id, row_number() over (
    partition by project_id
    order by last_used_at desc nulls last, created_at desc, id desc
  ) as rn
  from api_keys
) d
where a.id = d.id and d.rn > 1;

-- ------------------------------------------------------------
-- 3. One key per project
-- ------------------------------------------------------------
create unique index if not exists api_keys_project_id_uniq
  on api_keys (project_id);
