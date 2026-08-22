-- ============================================================
-- WhatsApp Coexistence — preserve a client's existing chat
-- history/contacts when connecting a number already on the
-- WhatsApp Business App, instead of forcing a destructive
-- disconnect during Embedded Signup.
-- ============================================================
-- Mirrors the last_synced_at/last_sync_error pattern already used by
-- shopify_integrations (sources/shopify.py) — same idea, applied to
-- WhatsApp for the first time.
--
-- Safe to re-run.
-- ============================================================

alter table whatsapp_integrations add column if not exists coexistence_enabled boolean not null default false;
alter table whatsapp_integrations add column if not exists history_sync_status text not null default 'not_applicable';
alter table whatsapp_integrations add column if not exists history_sync_requested_at timestamptz;
alter table whatsapp_integrations add column if not exists history_sync_completed_at timestamptz;
alter table whatsapp_integrations add column if not exists contacts_sync_request_id text;
alter table whatsapp_integrations add column if not exists history_sync_request_id text;
alter table whatsapp_integrations add column if not exists last_sync_error text;

-- Idempotency key for inbound message ingestion (live webhook + historical
-- sync chunks + Meta's own at-least-once webhook redelivery all need to be
-- able to land the same message twice without creating a duplicate row).
alter table chat_messages add column if not exists wa_message_id text;
alter table chat_messages add column if not exists message_type text not null default 'text';

-- Deliberately NOT a partial index (no "where wa_message_id is not null"):
-- Postgres never treats two NULLs as conflicting in a unique index, so
-- normal live messages (which don't set wa_message_id) are completely
-- unaffected — but a plain (non-partial) index is what lets Supabase's
-- upsert(on_conflict="chat_id,wa_message_id") actually target it; PostgREST
-- can't express a partial index's WHERE clause in an on_conflict param.
create unique index if not exists chat_messages_wa_message_id_idx
  on chat_messages (chat_id, wa_message_id);

-- Best-effort signal for suppressing the bot's automatic reply when the
-- business owner already replied manually from their own phone (see
-- backend/chat.py's run_chat()). Not a hard guarantee — smb_message_echoes
-- arrives after the fact, not synchronously.
alter table chats add column if not exists last_human_reply_at timestamptz;
