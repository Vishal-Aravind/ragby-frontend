-- ============================================================
-- Shopify integration — Piece 3: storefront widget checkout
-- ============================================================
-- storefront_access_token is a SEPARATE credential from
-- shopify_integrations.access_token — the Admin API token (already stored)
-- can't build a shopper-facing cart/checkout; that's the Storefront API's
-- job, which uses its own token type. Minted once via the Admin API's
-- storefrontAccessTokenCreate mutation right after connecting.
alter table shopify_integrations add column if not exists storefront_access_token text;

-- One row per Shopify cart the widget builds, tied to the specific chat
-- session that created it — this is how the orders/paid webhook (which has
-- no other built-in link back to "which conversation created this cart")
-- gets matched back: the cart is stamped with a `ragby_chat_id` custom
-- attribute at creation time, which Shopify carries through to the
-- resulting order's note_attributes.
create table if not exists shopify_cart_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  chat_id uuid not null references chats(id) on delete cascade,
  shopify_cart_id text not null,
  checkout_url text not null,
  status text not null default 'open',  -- 'open' | 'completed'
  shopify_order_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists shopify_cart_sessions_chat_idx on shopify_cart_sessions (chat_id);

-- Safe to re-run.
