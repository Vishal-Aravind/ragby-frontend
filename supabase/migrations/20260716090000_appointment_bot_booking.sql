-- ============================================================
-- Let the AI bot book appointments directly in chat
-- ============================================================
-- Separate from `is_enabled` (which controls the public /book/[projectId]
-- page). A merchant might want the booking page live but NOT let the bot
-- book on its own, or vice versa — so this is its own explicit opt-in,
-- off by default. See backend/chat.py's tool-calling loop.
--
-- Safe to re-run.
-- ============================================================

alter table appointment_settings add column if not exists bot_can_book boolean not null default false;
