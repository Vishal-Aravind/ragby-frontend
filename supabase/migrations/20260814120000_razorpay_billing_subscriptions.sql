-- ============================================================
-- Replace Stripe with Razorpay for Zavo's OWN SaaS subscription billing
-- ============================================================
-- Pre-launch, zero real subscribers on Stripe (test mode only) — dropping
-- the Stripe columns outright rather than leaving them vestigial. This is
-- the opposite call from the earlier merchant-payments migrations (e.g.
-- 20260810120000_razorpay_partner_oauth.sql), where the legacy columns
-- were deliberately kept because real payment links were in flight at
-- cutover — nothing is in flight here, so a clean drop is correct.
--
-- This is Zavo's OWN Razorpay merchant account charging Zavo's OWN SaaS
-- customers — completely separate from:
--   - razorpay_connections (backend/razorpay_oauth.py) — Shop/Appointment
--     merchants connecting THEIR OWN Razorpay account via OAuth.
--   - shop_config.razorpay_key_id/secret (backend/shop.py) — legacy
--     per-merchant manual key fallback.
-- See backend/billing.py and backend/config.py's RAZORPAY_BILLING_* vars.
--
-- plan itself is untouched — already provider-agnostic ("free"/"pro"/
-- "business"), consumed by usage.py regardless of payment provider.
--
-- Safe to re-run.
-- ============================================================

alter table profiles add column if not exists razorpay_customer_id text;
alter table profiles add column if not exists razorpay_subscription_id text;

alter table profiles drop column if exists stripe_customer_id;
alter table profiles drop column if exists stripe_subscription_id;

create index if not exists profiles_razorpay_subscription_idx
  on profiles (razorpay_subscription_id);
