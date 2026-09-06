-- ============================================================
-- Generic webhook idempotency
-- ============================================================
-- whatsapp_webhook_dedup (20260825120000) fixed duplicate bot replies for
-- WhatsApp, but every other provider retries too and none of them dedupe:
--
--   * Slack resends when it doesn't get a 200 within 3s — and run_chat
--     routinely takes longer, so the NORMAL path is up to 4 identical
--     replies and 4x the OpenAI spend for one question.
--   * Telegram redelivers an update until it's acknowledged.
--   * Razorpay retries billing events. A replayed (genuinely signed)
--     subscription.cancelled downgrades a paying customer to free; a
--     replayed subscription.activated resurrects a cancelled plan.
--     Signature verification cannot help here — the body is authentic.
--   * Shopify retries product/order webhooks, each replay costing a
--     GraphQL fetch plus a fresh embedding.
--
-- One table for all of them, keyed by (source, event_id). First writer
-- wins on the primary key, same pattern as the WhatsApp table.
--
-- Safe to re-run.
-- ============================================================

create table if not exists webhook_dedup (
  source      text        not null,
  event_id    text        not null,
  created_at  timestamptz not null default now(),
  primary key (source, event_id)
);

-- Service-role only; nothing user-facing ever reads this.
alter table webhook_dedup enable row level security;

create index if not exists webhook_dedup_created_at_idx
  on webhook_dedup (created_at);


-- Rows are only useful for as long as a provider might still retry.
-- Called opportunistically from the backend rather than on a cron.
create or replace function prune_webhook_dedup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from webhook_dedup where created_at < now() - interval '7 days';
$$;
