-- ============================================================
-- Razorpay Partner OAuth — replaces manual Key ID/Secret entry
-- ============================================================
-- One Razorpay connected-account per project (same one-account-per-project
-- shape as shopify_integrations). Unlike Shopify's non-expiring offline
-- token, Razorpay OAuth access tokens expire and use a rotating refresh
-- token (confirmed against Razorpay's Partner OAuth docs) — closer to
-- Google Calendar's refresh-token shape in appointment_settings than to
-- Shopify's. Stored as plain text, consistent with every other integration
-- in this codebase (shopify_integrations.access_token,
-- appointment_settings.google_refresh_token) — no encryption-at-rest
-- anywhere in this codebase today.
--
-- shop_config.razorpay_key_id/razorpay_key_secret are deliberately left
-- untouched by this migration — they remain a fallback for payment links
-- created before a merchant reconnects via OAuth (see backend/shop.py's
-- webhook signature verification), and are removed only in a future
-- cleanup migration once no outstanding pre-cutover links remain.
--
-- Safe to re-run.
-- ============================================================

create table if not exists razorpay_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  razorpay_account_id text,
  access_token text not null,
  refresh_token text,
  token_type text not null default 'Bearer',
  expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists razorpay_connections_project_idx
  on razorpay_connections (project_id);