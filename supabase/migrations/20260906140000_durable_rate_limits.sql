-- ============================================================
-- Durable rate limiting
-- ============================================================
-- backend/ratelimit.py kept its counters in a module-level dict, which is
-- lost on every process restart. On Render's free tier the service sleeps
-- after ~15 minutes of inactivity and cold-starts on the next request, so
-- in practice every limit resets constantly:
--   * login/signup brute-force protection (auth.py) resets
--   * the per-project caps that bound OpenAI spend reset
-- It also never evicted keys, so the dict grew forever.
--
-- This moves the state into Postgres. Safe to re-run.
-- ============================================================

create table if not exists rate_limits (
  key           text primary key,
  window_start  timestamptz not null default now(),
  count         integer     not null default 0
);

-- Only ever touched by the backend's service-role client.
alter table rate_limits enable row level security;

create index if not exists rate_limits_window_start_idx
  on rate_limits (window_start);


-- One atomic upsert per check, so two concurrent requests can't both read
-- a stale count and each decide they're under the limit.
-- Returns true when the caller has EXCEEDED the limit, matching the
-- semantics of the Python helper it replaces: every call counts as an
-- attempt, and the check is `count > limit`.
create or replace function check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_expired_before timestamptz := now() - make_interval(secs => p_window_seconds);
begin
  insert into rate_limits (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
          when rate_limits.window_start < v_expired_before then 1
          else rate_limits.count + 1
        end,
        window_start = case
          when rate_limits.window_start < v_expired_before then now()
          else rate_limits.window_start
        end
  returning count into v_count;

  -- Opportunistic cleanup: IP-keyed rows are unbounded in number, so
  -- without this the table grows forever. Runs on ~1% of calls to keep
  -- the common path a single statement.
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count > p_limit;
end;
$$;
