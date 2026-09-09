-- ============================================================
-- Billing: one live subscription per profile
-- ============================================================
-- /billing/subscribe never checked for an existing subscription, and
-- profiles.razorpay_subscription_id had only a plain index
-- (20260814120000_razorpay_billing_subscriptions.sql:31). So a double-click
-- during checkout created a SECOND Razorpay subscription and overwrote the
-- column with it — the first kept billing the customer with no record of it
-- anywhere, and when that orphan eventually ended, its
-- subscription.cancelled webhook downgraded a still-paying customer to free.
--
-- The application now refuses a second subscribe while one is live, and the
-- webhook only acts on the subscription the profile actually points at.
-- This index is the database-level backstop for both.
--
-- Safe to re-run.
-- ============================================================

-- Partial: most profiles have no subscription at all, and those must not
-- collide with each other on null.
create unique index if not exists profiles_razorpay_subscription_uniq
  on profiles (razorpay_subscription_id)
  where razorpay_subscription_id is not null;
