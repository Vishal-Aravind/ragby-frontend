-- ============================================================
-- Shop branches: per-branch menus, opening hours, pickup/delivery
-- with server-computed delivery fee, per-branch order routing.
-- Backward compatible: every project with shop data gets one default
-- "Main" branch (always open, hours NULL) owning all existing
-- catalogs and orders; a BEFORE INSERT trigger assigns the default
-- branch to any catalog/order inserted without one (Shopify sync,
-- chat bot, stale clients). Safe to re-run.
-- ============================================================

-- 1. Branches -------------------------------------------------
create table if not exists public.shop_branches (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  name                text not null check (char_length(name) between 1 and 80),
  address             text check (address is null or char_length(address) <= 300),
  phone               text check (phone is null or phone ~ '^[0-9]{8,15}$'),  -- digits incl. country code
  lat                 double precision check (lat is null or lat between -90 and 90),
  lng                 double precision check (lng is null or lng between -180 and 180),
  pincodes            text[] not null default '{}',
  hours               jsonb,                       -- NULL = always open; shape in section B.1
  timezone            text not null default 'Asia/Kolkata',
  is_default          boolean not null default false,
  is_active           boolean not null default true,
  accepting_orders    boolean not null default true,
  pickup_enabled      boolean not null default true,
  delivery_enabled    boolean not null default false,
  delivery_per_km     numeric(10,2) not null default 0 check (delivery_per_km >= 0 and delivery_per_km <= 10000),
  delivery_base_fee   numeric(10,2) not null default 0 check (delivery_base_fee >= 0 and delivery_base_fee <= 100000),
  free_delivery_above numeric(10,2) check (free_delivery_above is null or free_delivery_above >= 0),
  max_delivery_km     numeric(6,2)  check (max_delivery_km is null or (max_delivery_km > 0 and max_delivery_km <= 100)),
  min_order_value     numeric(10,2) not null default 0 check (min_order_value >= 0),
  prep_minutes        integer check (prep_minutes is null or prep_minutes between 0 and 600),
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint shop_branches_latlng_pair  check ((lat is null) = (lng is null)),
  constraint shop_branches_pincodes_max check (cardinality(pincodes) <= 500),
  constraint shop_branches_hours_object check (hours is null or jsonb_typeof(hours) = 'object')
);

create unique index if not exists shop_branches_one_default
  on public.shop_branches (project_id) where is_default;
-- Target of the composite FKs below (FK needs a non-partial unique index).
create unique index if not exists shop_branches_id_project
  on public.shop_branches (id, project_id);
create index if not exists shop_branches_project_sort
  on public.shop_branches (project_id, sort_order);

-- 2. Catalogs / orders columns ---------------------------------
alter table public.catalogs add column if not exists branch_id uuid;

alter table public.orders add column if not exists branch_id            uuid;
alter table public.orders add column if not exists fulfilment           text;
alter table public.orders add column if not exists delivery_fee         numeric(10,2) not null default 0;
alter table public.orders add column if not exists delivery_distance_km numeric(8,2);
alter table public.orders add column if not exists delivery_address     text;
alter table public.orders add column if not exists customer_lat         double precision;
alter table public.orders add column if not exists customer_lng         double precision;
alter table public.orders add column if not exists customer_pincode     text;
alter table public.orders add column if not exists customer_name        text;

-- 3. Default-branch helper + trigger ---------------------------
create or replace function public.shop_default_branch_id(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_tz    text;
  v_phone text;
begin
  if p_project_id is null then
    return null;
  end if;

  select id into v_id from shop_branches
   where project_id = p_project_id and is_default limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select timezone into v_tz from appointment_settings
   where project_id = p_project_id limit 1;
  select regexp_replace(coalesce(store_phone, ''), '\D', '', 'g') into v_phone
    from shop_config where project_id = p_project_id limit 1;
  if v_phone is null or v_phone !~ '^[0-9]{8,15}$' then
    v_phone := null;
  end if;

  insert into shop_branches (project_id, name, phone, timezone, is_default, sort_order)
  values (p_project_id, 'Main', v_phone, coalesce(nullif(v_tz, ''), 'Asia/Kolkata'), true, 0)
  on conflict (project_id) where is_default do nothing;

  select id into v_id from shop_branches
   where project_id = p_project_id and is_default limit 1;
  return v_id;
end $$;

revoke all on function public.shop_default_branch_id(uuid) from public, anon, authenticated;
grant execute on function public.shop_default_branch_id(uuid) to service_role;

create or replace function public.shop_fill_branch_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null and new.project_id is not null then
    new.branch_id := shop_default_branch_id(new.project_id);
  end if;
  return new;
end $$;

revoke all on function public.shop_fill_branch_id() from public, anon, authenticated;

drop trigger if exists catalogs_fill_branch_id on public.catalogs;
create trigger catalogs_fill_branch_id before insert on public.catalogs
  for each row execute function public.shop_fill_branch_id();

drop trigger if exists orders_fill_branch_id on public.orders;
create trigger orders_fill_branch_id before insert on public.orders
  for each row execute function public.shop_fill_branch_id();

-- 4. Backfill ---------------------------------------------------
do $$
declare
  r       record;
  existed boolean;
  v_id    uuid;
begin
  for r in
    select distinct s.project_id from (
      select project_id from shop_config
      union select project_id from catalogs
      union select project_id from orders
    ) s
    where s.project_id is not null
      and exists (select 1 from projects p where p.id = s.project_id)
  loop
    existed := exists (select 1 from shop_branches where project_id = r.project_id and is_default);
    v_id := shop_default_branch_id(r.project_id);
    -- Only on first creation, so a re-run never re-enables delivery a merchant turned off.
    if not existed then
      update shop_branches b set delivery_enabled = true
        from shop_config c
       where b.id = v_id and c.project_id = r.project_id
         and c.delivery_types::text ilike '%deliver%';
    end if;
  end loop;
end $$;

update public.catalogs c set branch_id = b.id
  from public.shop_branches b
 where c.branch_id is null and b.project_id = c.project_id and b.is_default;

update public.orders o set branch_id = b.id
  from public.shop_branches b
 where o.branch_id is null and b.project_id = o.project_id and b.is_default;

update public.orders
   set fulfilment = case when coalesce(delivery_type, '') ilike '%deliver%' then 'delivery' else 'pickup' end
 where fulfilment is null;
alter table public.orders alter column fulfilment set default 'pickup';
alter table public.orders alter column fulfilment set not null;

-- Dashboard used to write 'delivered' (not in backend vocabulary).
update public.orders set status = 'completed' where status = 'delivered';

-- 5. Constraints ------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'catalogs_branch_fk') then
    alter table public.catalogs add constraint catalogs_branch_fk
      foreign key (branch_id, project_id) references public.shop_branches (id, project_id)
      on delete cascade;
  end if;

  -- NO ACTION (not RESTRICT): checked at statement end, so a project delete
  -- that cascades to both orders and branches still succeeds.
  if not exists (select 1 from pg_constraint where conname = 'orders_branch_fk') then
    alter table public.orders add constraint orders_branch_fk
      foreign key (branch_id, project_id) references public.shop_branches (id, project_id)
      on delete no action;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_fulfilment_check') then
    alter table public.orders add constraint orders_fulfilment_check
      check (fulfilment in ('pickup', 'delivery'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_delivery_fee_check') then
    alter table public.orders add constraint orders_delivery_fee_check
      check (delivery_fee >= 0 and delivery_fee <= 100000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_customer_coords_check') then
    alter table public.orders add constraint orders_customer_coords_check
      check ((customer_lat is null or customer_lat between -90 and 90)
         and (customer_lng is null or customer_lng between -180 and 180));
  end if;
end $$;

create index if not exists catalogs_branch_idx       on public.catalogs (branch_id);
create index if not exists orders_project_branch_idx on public.orders (project_id, branch_id, created_at desc);

-- 6. Pincode geocode cache (service role only) ----------------
create table if not exists public.geocode_cache (
  country_code text not null,             -- 'IN'
  postal_code  text not null,             -- normalised, e.g. '600042'
  found        boolean not null,
  lat          double precision,
  lng          double precision,
  source       text not null default 'nominatim',
  fetched_at   timestamptz not null default now(),
  primary key (country_code, postal_code)
);

-- 7. Atomic menu copy -------------------------------------------
create or replace function public.copy_shop_menu(
  p_project_id    uuid,
  p_source_branch uuid,
  p_target_branch uuid,
  p_replace       boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat     record;
  v_new_cat uuid;
  v_cats    int := 0;
  v_prods   int := 0;
  v_n       int;
begin
  if p_source_branch = p_target_branch then
    raise exception 'same_branch';
  end if;

  perform 1 from shop_branches where id = p_source_branch and project_id = p_project_id;
  if not found then
    raise exception 'branch_not_found';
  end if;

  perform 1 from shop_branches where id = p_target_branch and project_id = p_project_id for update;
  if not found then
    raise exception 'branch_not_found';
  end if;

  if (select count(*) from catalogs where branch_id = p_source_branch) > 100
     or (select count(*) from products p join catalogs c on c.id = p.catalog_id
          where c.branch_id = p_source_branch) > 5000 then
    raise exception 'too_large';
  end if;

  if p_replace then
    -- Shopify-synced catalogs are sync-owned; never deleted here.
    delete from products where catalog_id in (
      select id from catalogs
       where branch_id = p_target_branch and project_id = p_project_id
         and coalesce(source, 'manual') <> 'shopify');
    delete from catalogs
     where branch_id = p_target_branch and project_id = p_project_id
       and coalesce(source, 'manual') <> 'shopify';
  end if;

  for v_cat in
    select * from catalogs
     where branch_id = p_source_branch and project_id = p_project_id
     order by created_at
  loop
    insert into catalogs (project_id, branch_id, name, description, is_active, source, created_at)
    values (p_project_id, p_target_branch, v_cat.name, v_cat.description, v_cat.is_active,
            'manual', clock_timestamp())
    returning id into v_new_cat;
    v_cats := v_cats + 1;

    -- Shopify ids deliberately NOT copied (products_project_variant_unique).
    insert into products (project_id, catalog_id, name, description, price, image_url,
                          category, gst_percent, is_available, sort_order, sku, created_at)
    select p_project_id, v_new_cat, name, description, price, image_url,
           category, gst_percent, is_available, sort_order, sku, clock_timestamp()
      from products
     where catalog_id = v_cat.id and project_id = p_project_id
     order by sort_order;
    get diagnostics v_n = row_count;
    v_prods := v_prods + v_n;
  end loop;

  return jsonb_build_object('catalogs_copied', v_cats, 'products_copied', v_prods);
end $$;

revoke all on function public.copy_shop_menu(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.copy_shop_menu(uuid, uuid, uuid, boolean) to service_role;

-- 8. RLS ---------------------------------------------------------
alter table public.shop_branches enable row level security;
-- Read-only for members. Every write goes through the backend (service
-- role), which enforces admin-only edits and validates hours/fees/phone.
-- A FOR ALL policy would let any member (agents too) PATCH branches
-- straight through PostgREST with their session token, skipping both, and
-- a malformed `hours` value would then break every public shop endpoint.
drop policy if exists "shop_branches_project_access" on public.shop_branches;
drop policy if exists "shop_branches_member_read" on public.shop_branches;
create policy "shop_branches_member_read"
  on public.shop_branches for select
  using (is_project_owner_or_active_member(auth.uid(), shop_branches.project_id));

alter table public.geocode_cache enable row level security;  -- no policies: service role only
-- Belt and braces on top of RLS: the cache is only ever read and written by
-- the backend's service role.
revoke all on table public.geocode_cache from anon, authenticated;
