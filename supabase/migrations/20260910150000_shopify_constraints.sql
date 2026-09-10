-- ============================================================
-- Shopify: stop duplicate reconciliations and duplicate data sources
-- ============================================================
-- Two select-then-insert races in shopify_oauth.py, neither backed by a
-- constraint:
--
-- 1. The orders/paid webhook checks `orders` for an existing
--    shopify_order_id with maybe_single() before inserting. Shopify retries
--    webhooks, and although webhook_dedup catches a replay of the same
--    delivery, two DIFFERENT deliveries for one order would both insert —
--    after which every later maybe_single() on that id RAISES, permanently
--    breaking reconciliation for that order.
--
-- 2. _ensure_data_source_and_kick_off_sync does the same select-then-insert
--    for the project's shopify data source, so a reconnect racing itself
--    leaves two, and the Documents tab shows the store twice.
--
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Collapse any duplicates first
-- ------------------------------------------------------------
-- Keeps the oldest row per Shopify order — it owns the real created_at and
-- is the one any earlier lookup would already have returned.
delete from orders o
using (
  select id, row_number() over (
    partition by shopify_order_id
    order by created_at asc, id asc
  ) as rn
  from orders
  where shopify_order_id is not null
) d
where o.id = d.id and d.rn > 1;

delete from data_sources s
using (
  select id, row_number() over (
    partition by project_id
    order by created_at asc, id asc
  ) as rn
  from data_sources
  where type = 'shopify'
) d
where s.id = d.id and d.rn > 1;

-- ------------------------------------------------------------
-- 2. The constraints
-- ------------------------------------------------------------
-- Partial: the vast majority of orders come from WhatsApp and have no
-- Shopify id, and those must not collide with each other on null.
create unique index if not exists orders_shopify_order_id_uniq
  on orders (shopify_order_id)
  where shopify_order_id is not null;

-- One Shopify data source per project. Other source types are unaffected.
create unique index if not exists data_sources_project_shopify_uniq
  on data_sources (project_id)
  where type = 'shopify';
