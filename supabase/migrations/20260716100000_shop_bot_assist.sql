-- ============================================================
-- Let the AI bot check orders and answer product questions in chat
-- ============================================================
-- Scope note: this covers READ-ONLY actions only — checking an existing
-- order's status and browsing the catalog to answer "what do you sell"
-- style questions. It deliberately does NOT let the bot place a new order
-- or touch the cart — that flow already has its own proven, button-driven
-- WhatsApp session state machine (see shop.py's submit_cart +
-- whatsapp_sessions "awaiting_cart_confirm" mode), and having a second,
-- free-form path create orders risks the two mechanisms conflicting.
-- AI-driven ordering is a separate, harder problem for later.
--
-- Safe to re-run.
-- ============================================================

alter table shop_config add column if not exists bot_can_assist boolean not null default false;
