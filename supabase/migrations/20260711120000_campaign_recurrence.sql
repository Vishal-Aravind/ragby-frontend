-- ============================================================
-- Recurring campaigns
-- ============================================================
-- Adds an optional repeat cadence to a scheduled campaign. When it fires,
-- if `recurrence` is set, the same row gets its contacts re-resolved and
-- scheduled_at bumped to the next occurrence instead of staying "sent"
-- for good — see backend/campaigns.py dispatch_scheduled_campaigns().
--
-- Safe to re-run.
-- ============================================================

alter table campaigns add column if not exists recurrence text; -- null | 'daily' | 'weekly' | 'monthly'
