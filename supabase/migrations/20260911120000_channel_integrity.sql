-- ============================================================
-- Channel integrity: atomic usage counting + integration uniqueness
-- ============================================================
-- Three problems, all of them races that the Telegram/Slack audit surfaced
-- but none of them specific to those two channels.
--
-- 1. increment_usage() in backend/usage.py reads `count`, adds one in
--    Python, and writes the result back. Two concurrent messages both read
--    N and both write N+1, so the customer is billed for fewer AI replies
--    than they consumed. Every channel goes through this function.
--
-- 2. The same function INSERTS a fresh usage row when none exists for the
--    month. Two concurrent first-messages of a month create two rows, and
--    check_rate_limit() then reads usage.data[0] — one row of the pair,
--    forever. The other accumulates invisibly and the monthly cap is
--    permanently undercounted for that user. That is a standing quota
--    bypass, not a rounding error.
--
-- 3. telegram.py and slack.py both upsert with on_conflict="project_id",
--    and both guard against a bot/workspace already claimed by another
--    project with a read-then-write. Neither table has a create-table
--    migration in this repo, so the constraint those upserts depend on is
--    untracked, and the cross-project guards are advisory only.
--
-- Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Collapse duplicate usage rows before constraining the table
-- ------------------------------------------------------------
-- These must be SUMMED, not deduplicated away. Each row holds real usage
-- that the customer actually consumed; dropping one would hand back free
-- quota. The oldest row per (user_id, month) absorbs the total.
with totals as (
  select user_id, month, sum(count) as true_total
  from usage
  group by user_id, month
  having count(*) > 1
),
keepers as (
  select distinct on (user_id, month) id, user_id, month
  from usage
  where (user_id, month) in (select user_id, month from totals)
  order by user_id, month, id asc
)
update usage u
set count = t.true_total
from keepers k
join totals t on t.user_id = k.user_id and t.month = k.month
where u.id = k.id;

delete from usage u
using (
  select id, row_number() over (
    partition by user_id, month order by id asc
  ) as rn
  from usage
) d
where u.id = d.id and d.rn > 1;

create unique index if not exists usage_user_month_uniq
  on usage (user_id, month);


-- ------------------------------------------------------------
-- 2. Atomic increment
-- ------------------------------------------------------------
-- One statement. The unique index above turns the concurrent case into an
-- ON CONFLICT update rather than a second row, and `usage.count + 1` is
-- evaluated by Postgres against the locked row rather than by a caller
-- holding a stale read.
create or replace function increment_usage_atomic(
  p_user_id uuid,
  p_month   text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into usage (user_id, month, count)
  values (p_user_id, p_month, 1)
  on conflict (user_id, month)
  do update set count = usage.count + 1
  returning count into v_count;

  return v_count;
end;
$$;


-- ------------------------------------------------------------
-- 3. Integration uniqueness
-- ------------------------------------------------------------
-- Keep one row per project. Addressed by ctid rather than a named key
-- because neither table has a create-table migration in this repo, so the
-- column list is not something this file can safely assume.
delete from telegram_integrations
where ctid in (
  select ctid from (
    select ctid, row_number() over (partition by project_id) as rn
    from telegram_integrations
  ) d where d.rn > 1
);

delete from slack_integrations
where ctid in (
  select ctid from (
    select ctid, row_number() over (partition by project_id) as rn
    from slack_integrations
  ) d where d.rn > 1
);

create unique index if not exists telegram_integrations_project_uniq
  on telegram_integrations (project_id);

-- The cross-project guard in telegram.py:94-105 is a read-then-write; this
-- is what actually stops two projects claiming one bot.
create unique index if not exists telegram_integrations_bot_token_uniq
  on telegram_integrations (bot_token)
  where bot_token is not null;

create unique index if not exists slack_integrations_project_uniq
  on slack_integrations (project_id);

-- Same for slack.py:126-137 and one Slack workspace.
create unique index if not exists slack_integrations_team_uniq
  on slack_integrations (team_id)
  where team_id is not null;


-- ------------------------------------------------------------
-- 4. Per-project Telegram webhook secret
-- ------------------------------------------------------------
-- The webhook previously compared against a single global
-- TELEGRAM_WEBHOOK_SECRET shared by every project, so anyone who learned it
-- could forge updates into any project and burn its AI quota. WhatsApp
-- never had this problem because it HMACs the request body.
--
-- Nullable on purpose: rows written before this migration have no secret,
-- and the handler accepts the legacy global value for exactly those until
-- they are reconnected. See the fallback in telegram.py.
alter table telegram_integrations
  add column if not exists webhook_secret text;
