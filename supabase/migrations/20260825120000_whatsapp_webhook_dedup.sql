-- ============================================================
-- Fix: bot re-sending the same reply on WhatsApp webhook redelivery
-- ============================================================
-- Confirmed live: a customer's bot replied correctly once, then sent the
-- exact same reply again unprompted 6 more times over the next ~2.5 hours,
-- with no new customer message in between. Root cause: the live inbound
-- message path (whatsapp.py's webhook handler -> flows.handle_text) has no
-- idempotency check on the message's wa_message_id, unlike the coexistence
-- history/echo sync paths (which already upsert on chat_messages'
-- (chat_id, wa_message_id) for exactly this reason). Meta's Cloud API
-- redelivers a webhook at-least-once if the endpoint doesn't ack fast
-- enough or errors — every redelivery re-triggered a fresh bot reply.
--
-- Deliberately a separate table, not a reuse of chat_messages: chat_messages
-- holds real conversation content (used for AI context, shown in the
-- Conversations tab) that gets saved via flows.py's save_message(), which
-- has 14 call sites across flows.py/chat.py. Threading a wa_message_id
-- through all of them (or double-inserting) is real, avoidable risk for
-- what's really just a one-time "have I seen this message id" check. This
-- table exists purely for that check, isolated from the message content
-- itself.
--
-- Safe to re-run.
-- ============================================================

create table if not exists whatsapp_webhook_dedup (
  wa_message_id text primary key,
  created_at timestamptz not null default now()
);

alter table whatsapp_webhook_dedup enable row level security;
-- No policies added deliberately — service-role only (queried exclusively
-- from backend/whatsapp.py via the service-role client), same zero-policy
-- lockdown treatment as every other backend-only table.
