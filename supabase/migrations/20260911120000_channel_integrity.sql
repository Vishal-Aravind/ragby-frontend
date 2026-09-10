-- ============================================================
-- Channel integrity: atomic usage counting + integration uniqueness
-- ============================================================
-- Scoped against the live schema, which already had more constraints than
-- the repo's migrations record. What is left is genuinely missing:
--
-- 1. increment_usage() in backend/usage.py reads `count`, adds one in
--    Python, and writes the result back. Two concurrent messages both read
--    N and both write N+1, so the customer is billed for fewer AI replies
--    than they consumed. Every channel goes through this function.
--
--    Its INSERT branch had a second, separate failure. usage already has a
--    unique index on (user_id, month), so two concurrent first-messages of
--    a month did not create two rows — the loser raised 23505, which the
--    function's broad `except Exception` swallowed, and that message went
--    unbilled. Narrower than a duplicate row, but the same direction: we
--    undercount, never overcount.
--
-- 2. telegram_integrations and slack_integrations are already unique on
--    project_id, so the on_conflict="project_id" upserts are safe. What is
--    NOT constrained is the cross-project guard: telegram.py:94-105 and
--    slack.py:126-137 both check for a bot/workspace already claimed by
--    another project with a read-then-write, which two concurrent connects
--    slip straight through.
--
-- 3. The Telegram webhook secret is a single global value shared by every
--    project.
--
-- Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Atomic increment
-- ------------------------------------------------------------
-- One statement, resolved by Postgres against the locked row rather than
-- by a caller holding a stale read. ON CONFLICT targets the existing
-- usage_user_id_month_key index.
--
-- coalesce because usage.count is nullable: a row with a null count would
-- otherwise stay null forever, since null + 1 is null. That row would then
-- read as zero usage in check_rate_limit — unlimited free messages.
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
  do update set count = coalesce(usage.count, 0) + 1
  returning count into v_count;

  return v_count;
end;
$$;

-- Backfill any pre-existing null so the cap is enforced from a real number.
update usage set count = 0 where count is null;


-- ------------------------------------------------------------
-- 2. The cross-project guards, enforced rather than advised
-- ------------------------------------------------------------
-- project_id is already unique on both tables (telegram_integrations_
-- project_id_key, slack_integrations_project_id_key), so nothing is added
-- for that. These two are the ones with no constraint behind them.
--
-- Telegram allows only ONE webhook per bot, so two projects connecting the
-- same bot means the second silently repoints the first: one merchant's
-- bot starts answering from another's knowledge base, and billing them.
create unique index if not exists telegram_integrations_bot_token_uniq
  on telegram_integrations (bot_token);

-- The Slack webhook resolves the project by team_id, so two projects on one
-- workspace makes that lookup pick one arbitrarily.
create unique index if not exists slack_integrations_team_uniq
  on slack_integrations (team_id)
  where team_id is not null;


-- ------------------------------------------------------------
-- 3. Per-project Telegram webhook secret
-- ------------------------------------------------------------
-- The webhook compared against one global TELEGRAM_WEBHOOK_SECRET shared by
-- every project, so anyone who learned it could forge updates into any
-- project and burn its AI quota. WhatsApp never had this problem because it
-- HMACs the request body.
--
-- Nullable on purpose: rows written before this migration have no secret,
-- and the handler accepts the legacy global value for exactly those until
-- they are reconnected. See _secret_matches in backend/telegram.py.
alter table telegram_integrations
  add column if not exists webhook_secret text;
