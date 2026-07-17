-- ============================================================
-- Let the AI bot place a new order in chat (WhatsApp only)
-- ============================================================
-- Separate from `bot_can_assist` (read-only order-status/catalog lookups) —
-- placing a real order is a bigger trust step, so it's its own explicit
-- opt-in, off by default. Only ever offered to the model when the
-- conversation is on WhatsApp, because the confirm/payment flow it hands
-- off to (Continue/Add More/Clear Cart buttons + Razorpay) is WhatsApp-only
-- today — see backend/chat.py and backend/shop.py's create_order_from_chat.
--
-- Safe to re-run.
-- ============================================================

alter table shop_config add column if not exists bot_can_order boolean not null default false;
