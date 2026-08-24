-- ============================================================
-- Track "cancel scheduled for cycle end" on Zavo's own side
-- ============================================================
-- Confirmed live (via a real cancel-at-cycle-end test) that Razorpay does
-- NOT change subscription.status when cancel_at_cycle_end is requested —
-- it stays "active" the whole time until the subscription actually ends.
-- The account page's "your subscription is cancelling on X" UI can't be
-- derived from Razorpay's live status field, so track it ourselves instead
-- of guessing at Razorpay's exact field semantics again.
--
-- Safe to re-run.
-- ============================================================

alter table profiles add column if not exists subscription_cancel_scheduled boolean not null default false;
