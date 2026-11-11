-- ============================================================
-- Shop: one store per shop (branches removed)
-- ============================================================
-- The store's own settings (location, hours, pickup/delivery, minimum
-- order, ready-in time, pause) move from shop_branches onto shop_config.
-- Each shop's values are copied from its default branch.
--
-- Nothing is deleted here. shop_branches, catalogs.branch_id,
-- orders.branch_id and shop_offers.branch_ids stay until the follow-up
-- drop migration, run only after the new single-store shop is tested.
--
-- The copy step below is wrapped in a check for shop_branches actually
-- existing: on a project where the original branches migration was never
-- run, there's no branch data to copy and shop_config's new columns just
-- keep their defaults.
--
-- Run once: re-running copies the old branch values over any settings
-- changed since.
-- ============================================================
alter table public.shop_config
  add column if not exists address             text check (address is null or char_length(address) <= 300),
  add column if not exists lat                 double precision check (lat is null or lat between -90 and 90),
  add column if not exists lng                 double precision check (lng is null or lng between -180 and 180),
  add column if not exists pincodes            text[] not null default '{}',
  add column if not exists hours               jsonb,
  add column if not exists timezone            text not null default 'Asia/Kolkata',
  add column if not exists accepting_orders    boolean not null default true,
  add column if not exists pickup_enabled      boolean not null default true,
  add column if not exists delivery_enabled    boolean not null default false,
  add column if not exists delivery_per_km     numeric(10,2) not null default 0
    check (delivery_per_km >= 0 and delivery_per_km <= 10000),
  add column if not exists delivery_base_fee   numeric(10,2) not null default 0
    check (delivery_base_fee >= 0 and delivery_base_fee <= 100000),
  add column if not exists free_delivery_above numeric(10,2)
    check (free_delivery_above is null or free_delivery_above >= 0),
  add column if not exists max_delivery_km     numeric(6,2)
    check (max_delivery_km is null or (max_delivery_km > 0 and max_delivery_km <= 100)),
  add column if not exists min_order_value     numeric(10,2) not null default 0
    check (min_order_value >= 0),
  add column if not exists prep_minutes        integer
    check (prep_minutes is null or prep_minutes between 0 and 600);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_config_latlng_pair') then
    alter table public.shop_config add constraint shop_config_latlng_pair check ((lat is null) = (lng is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shop_config_pincodes_max') then
    alter table public.shop_config add constraint shop_config_pincodes_max check (cardinality(pincodes) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shop_config_hours_object') then
    alter table public.shop_config add constraint shop_config_hours_object check (hours is null or jsonb_typeof(hours) = 'object');
  end if;
end $$;

-- Copy each shop's default branch onto its shop settings, but only if
-- shop_branches actually exists (see note above).
do $$
begin
  if to_regclass('public.shop_branches') is not null then
    execute $copy$
      update public.shop_config c
         set address             = b.address,
             lat                 = b.lat,
             lng                 = b.lng,
             pincodes            = coalesce(b.pincodes, '{}'),
             hours               = b.hours,
             timezone            = coalesce(nullif(b.timezone, ''), 'Asia/Kolkata'),
             accepting_orders    = coalesce(b.accepting_orders, true),
             pickup_enabled      = coalesce(b.pickup_enabled, true),
             delivery_enabled    = coalesce(b.delivery_enabled, false),
             delivery_per_km     = coalesce(b.delivery_per_km, 0),
             delivery_base_fee   = coalesce(b.delivery_base_fee, 0),
             free_delivery_above = b.free_delivery_above,
             max_delivery_km     = b.max_delivery_km,
             min_order_value     = coalesce(b.min_order_value, 0),
             prep_minutes        = b.prep_minutes,
             notify_owner_whatsapp = coalesce(b.notify_owner_whatsapp, c.notify_owner_whatsapp),
             -- The branch phone (digits) was where order alerts went.
             store_phone         = case when b.phone is not null then '+' || b.phone else c.store_phone end,
             store_name          = coalesce(nullif(btrim(c.store_name), ''), nullif(b.name, 'Main'), c.store_name),
             -- A branch's own GST details win over empty shop ones.
             gstin               = coalesce(nullif(btrim(c.gstin), ''), b.gstin),
             legal_name          = coalesce(nullif(btrim(c.legal_name), ''), b.legal_name),
             registered_address  = coalesce(nullif(btrim(c.registered_address), ''), b.registered_address),
             state               = coalesce(nullif(btrim(c.state), ''), b.state)
        from public.shop_branches b
       where b.project_id = c.project_id
         and b.is_default
    $copy$;
  end if;
end $$;
