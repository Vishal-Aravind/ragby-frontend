-- ============================================================
-- Durable OAuth state
-- ============================================================
-- Slack, Shopify and Razorpay each kept their pending OAuth nonces in a
-- module-level dict. Two problems:
--
--  1. Reliability. On Render's free tier the service sleeps after ~15 min
--     and cold-starts, and any restart (or a second worker) empties the
--     dict — so a user who started an OAuth flow got "This connection link
--     expired or was already used" on a perfectly valid first attempt,
--     with no way to recover but retrying and hoping.
--
--  2. The nonce recorded only project_id, not who minted it, so any member
--     of that project could redeem a nonce another member created.
--
-- Also records the shop/target the flow was started for, so the callback
-- can confirm it matches what was requested.
--
-- Safe to re-run.
-- ============================================================

create table if not exists oauth_states (
  nonce       text        primary key,
  provider    text        not null,
  project_id  uuid        not null,
  user_id     uuid        not null,
  target      text,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- Service-role only.
alter table oauth_states enable row level security;

create index if not exists oauth_states_expires_at_idx
  on oauth_states (expires_at);
