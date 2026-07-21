-- ============================================================
-- Let the AI bot register customers for an event directly in chat
-- ============================================================
-- Per-event opt-in (NOT project-wide) — unlike appointments (one global
-- service per project), a project can run multiple concurrent events, and
-- a merchant may want automation on a public webinar but NOT on an
-- invite-only/vetted event running at the same time. Off by default.
-- See backend/chat.py's EVENT_TOOLS / execute_event_tool.
--
-- Safe to re-run.
-- ============================================================

alter table events add column if not exists bot_can_register boolean not null default false;
