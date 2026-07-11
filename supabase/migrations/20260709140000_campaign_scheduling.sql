-- ============================================================
-- Campaign scheduling — send a campaign at a future date/time
-- ============================================================
-- Adds what's needed to queue a campaign instead of sending immediately:
--   scheduled_at       — when it should go out (null = send now, as today)
--   tag_filter         — which tag was used (wasn't persisted before)
--   resolved_contacts  — the exact recipient list, locked in at creation
--                         time, so "who gets this" is predictable and
--                         doesn't drift if leads/tags change before it fires
--   phone_number_id    — which WhatsApp number to send from, resolved once
--                         up front rather than re-looked-up at send time
--
-- Purely additive. Safe to re-run.
-- ============================================================

alter table campaigns add column if not exists scheduled_at timestamptz;
alter table campaigns add column if not exists tag_filter text;
alter table campaigns add column if not exists resolved_contacts jsonb;
alter table campaigns add column if not exists phone_number_id text;
