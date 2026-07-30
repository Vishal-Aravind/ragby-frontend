-- ============================================================
-- Shopify integration — Piece 1: catalog sync
-- ============================================================
-- One Shopify store connection per project (matches the one-account-per-
-- business model). access_token is a Shopify OFFLINE token — unlike Google
-- Calendar's refresh-token dance in appointment_settings, Shopify offline
-- tokens are long-lived and stored directly (same shape as
-- slack_integrations.access_token).
--
-- Safe to re-run.
-- ============================================================

create table if not exists shopify_integrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  shop_domain text not null unique,
  access_token text not null,
  scope text,
  installed_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now()
);

-- Products/variants synced from a connected Shopify store. shopify_variant_id
-- is one row per purchasable variant (not one row per product) — a Shopify
-- product with size/color options becomes multiple products rows sharing one
-- shopify_product_id. Manually-entered products leave both columns null;
-- a plain (non-partial) unique constraint is used deliberately — Postgres
-- never treats two NULLs as colliding, so this doesn't affect manual
-- products, and it's the only constraint form Supabase's client-side
-- upsert(on_conflict=...) can target as an arbiter.
alter table products add column if not exists shopify_product_id text;
alter table products add column if not exists shopify_variant_id text;
alter table products add column if not exists sku text;
alter table products add column if not exists inventory_quantity integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_project_variant_unique'
  ) then
    alter table products add constraint products_project_variant_unique
      unique (project_id, shopify_variant_id);
  end if;
end $$;

create index if not exists products_shopify_product_idx
  on products (project_id, shopify_product_id);

-- 'manual' | 'shopify' — set once at creation, lets the dashboard lock/label
-- the auto-created "Shopify Products" catalog and disable its delete button.
alter table catalogs add column if not exists source text not null default 'manual';
