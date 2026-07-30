-- ============================================================
-- Shopify integration — Piece 2: WhatsApp ordering from Shopify
-- products + order write-back
-- ============================================================
-- currency_code is a real ISO-4217 code (e.g. "INR", "USD") — separate from
-- the existing shop_config.currency, which is only ever a display symbol
-- ("₹", "$") and was being silently ignored by generate_razorpay_link()'s
-- hardcoded "INR". Defaults to 'INR' to preserve today's actual behavior
-- for every existing store (nothing changes for them until they set this).
--
-- shopify_order_id records the Shopify order created after a WhatsApp/
-- Razorpay order is paid — nullable (most orders have no Shopify
-- integration at all), and doubles as the idempotency check so a retried
-- payment webhook never creates a duplicate order in Shopify.
--
-- Safe to re-run.
-- ============================================================

alter table shop_config add column if not exists currency_code text not null default 'INR';
alter table orders add column if not exists shopify_order_id text;
