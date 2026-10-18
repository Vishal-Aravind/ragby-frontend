-- ============================================================
-- Shop v3: offers & coupons (atomic redemption), pay-on-page
-- checkout (idempotent orders, payment-link history), structured
-- address, sold-out preference, branding images, rate-limit peek.
-- Safe to re-run.
-- ============================================================

-- 1. Branding ----------------------------------------------------
alter table public.shop_config   add column if not exists cover_image_url text;
alter table public.shop_config   add column if not exists logo_url        text;
alter table public.shop_branches add column if not exists image_url       text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_config_branding_check') then
    alter table public.shop_config add constraint shop_config_branding_check check (
      (cover_image_url is null or (char_length(cover_image_url) <= 1000 and cover_image_url ~ '^https://'))
      and (logo_url is null or (char_length(logo_url) <= 1000 and logo_url ~ '^https://')));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shop_branches_image_check') then
    alter table public.shop_branches add constraint shop_branches_image_check check (
      image_url is null or (char_length(image_url) <= 1000 and image_url ~ '^https://'));
  end if;
end $$;

-- shop_config keeps its FOR ALL member policy (the dashboard settings route
-- writes it with the user's session), so without this any member could PATCH
-- cover_image_url / logo_url to any https URL through PostgREST and skip the
-- backend's own-upload check (shop_rules.valid_media_url). Only the backend
-- (service role) may change them; other columns are unaffected.
create or replace function public.shop_config_branding_guard()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.cover_image_url is not null or new.logo_url is not null then
        raise exception 'Shop branding can only be changed from the dashboard' using errcode = '42501';
      end if;
    elsif new.cover_image_url is distinct from old.cover_image_url
       or new.logo_url is distinct from old.logo_url then
      raise exception 'Shop branding can only be changed from the dashboard' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists shop_config_branding_guard on public.shop_config;
create trigger shop_config_branding_guard
  before insert or update on public.shop_config
  for each row execute function public.shop_config_branding_guard();

-- 2. Offers ------------------------------------------------------
create table if not exists public.offers (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 60),
  description        text check (description is null or char_length(description) <= 200),
  kind               text not null check (kind in ('percent', 'flat', 'free_delivery')),
  value              numeric(10,2) not null default 0,
  max_discount       numeric(10,2),
  min_order_value    numeric(10,2) not null default 0 check (min_order_value >= 0 and min_order_value <= 99999999),
  application        text not null check (application in ('automatic', 'code')),
  code               text,                         -- stored UPPERCASE; NULL for automatic
  is_visible         boolean not null default true, -- code offers: shown in the offers strip?
  starts_at          timestamptz,
  ends_at            timestamptz,
  is_active          boolean not null default true,
  archived_at        timestamptz,                  -- soft delete (offer has redemptions)
  branch_ids         uuid[] not null default '{}', -- empty = all branches
  fulfilment         text not null default 'any' check (fulfilment in ('any', 'pickup', 'delivery')),
  first_order_only   boolean not null default false,
  usage_limit        integer check (usage_limit is null or usage_limit between 1 and 1000000),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit between 1 and 1000),
  sort_order         integer not null default 0,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint offers_value_check check (
       (kind = 'percent'       and value > 0 and value <= 100)
    or (kind = 'flat'          and value > 0 and value <= 100000)
    or (kind = 'free_delivery' and value = 0)),
  constraint offers_max_discount_check check (
    max_discount is null or (kind = 'percent' and max_discount > 0 and max_discount <= 100000)),
  constraint offers_code_presence check ((application = 'code') = (code is not null)),
  constraint offers_code_format   check (code is null or code ~ '^[A-Z0-9][A-Z0-9_-]{3,19}$'),
  constraint offers_window_check  check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint offers_branch_ids_max check (cardinality(branch_ids) <= 50),
  constraint offers_free_delivery_scope check (kind <> 'free_delivery' or fulfilment = 'delivery')
);

create unique index if not exists offers_id_project on public.offers (id, project_id);
-- Codes are unique per project among non-archived offers (case-insensitive: stored upper).
create unique index if not exists offers_project_code_unique
  on public.offers (project_id, code) where code is not null and archived_at is null;
create index if not exists offers_project_live
  on public.offers (project_id, is_active) where archived_at is null;

-- 3. Order columns -------------------------------------------------
alter table public.orders add column if not exists address_line1           text;
alter table public.orders add column if not exists address_line2           text;
alter table public.orders add column if not exists address_city            text;
alter table public.orders add column if not exists sold_out_preference     text;
alter table public.orders add column if not exists offer_id                uuid;
alter table public.orders add column if not exists offer_code              text;
alter table public.orders add column if not exists offer_title             text;
alter table public.orders add column if not exists discount_type           text;
alter table public.orders add column if not exists items_discount          numeric(10,2) not null default 0;
alter table public.orders add column if not exists delivery_discount       numeric(10,2) not null default 0;
alter table public.orders add column if not exists discount_amount         numeric(10,2) not null default 0;
alter table public.orders add column if not exists payment_method          text;
alter table public.orders add column if not exists placed_at               timestamptz;
alter table public.orders add column if not exists client_ref              uuid;
alter table public.orders add column if not exists checkout_hash           text;
alter table public.orders add column if not exists payment_link_url        text;
alter table public.orders add column if not exists payment_link_expires_at timestamptz;
alter table public.orders add column if not exists payment_link_ids        text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_sold_out_pref_check') then
    alter table public.orders add constraint orders_sold_out_pref_check
      check (sold_out_preference is null or sold_out_preference in ('remove_item', 'call_me', 'merchant_choice'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_method_check') then
    alter table public.orders add constraint orders_payment_method_check
      check (payment_method is null or payment_method in ('online', 'offline', 'none'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_discount_type_check') then
    alter table public.orders add constraint orders_discount_type_check
      check (discount_type is null or discount_type in ('percent', 'flat', 'free_delivery'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_discount_check') then
    alter table public.orders add constraint orders_discount_check check (
      items_discount >= 0 and delivery_discount >= 0
      and discount_amount = items_discount + delivery_discount);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_address_parts_check') then
    alter table public.orders add constraint orders_address_parts_check check (
      (address_line1 is null or char_length(address_line1) <= 110)
      and (address_line2 is null or char_length(address_line2) <= 110)
      and (address_city  is null or char_length(address_city)  <= 50));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_checkout_hash_check') then
    alter table public.orders add constraint orders_checkout_hash_check
      check (checkout_hash is null or checkout_hash ~ '^[0-9a-f]{64}$');
  end if;
  -- Offer of the same project; deleting an offer keeps the order (snapshot columns stay).
  if not exists (select 1 from pg_constraint where conname = 'orders_offer_fk') then
    alter table public.orders add constraint orders_offer_fk
      foreign key (offer_id, project_id) references public.offers (id, project_id)
      on delete set null (offer_id);
  end if;
end $$;

create unique index if not exists orders_project_client_ref_unique
  on public.orders (project_id, client_ref) where client_ref is not null;
create index if not exists orders_project_phone_created_idx
  on public.orders (project_id, phone_number, created_at desc);
create index if not exists orders_payment_link_ids_gin
  on public.orders using gin (payment_link_ids);

-- Backfill: anything that left the "cart" state counts as placed
-- (first-order checks and My Orders depend on placed_at).
update public.orders
   set placed_at = created_at
 where placed_at is null
   and (status <> 'pending' or payment_status <> 'unpaid');
update public.orders
   set payment_link_ids = array[payment_id]
 where payment_id is not null and payment_link_ids = '{}'
   and payment_status in ('link_sent', 'paid', 'underpaid', 'refunded');

-- 4. Redemptions -----------------------------------------------------
create table if not exists public.offer_redemptions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null,
  offer_id        uuid not null,
  order_id        uuid not null references public.orders(id) on delete cascade,
  customer_phone  text not null check (customer_phone ~ '^[0-9]{8,15}$'),
  verified        boolean not null default false,
  status          text not null check (status in ('held', 'confirmed', 'released')),
  hold_until      timestamptz,
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint offer_redemptions_offer_fk foreign key (offer_id, project_id)
    references public.offers (id, project_id) on delete cascade,
  constraint offer_redemptions_hold_check check (status <> 'held' or hold_until is not null)
);
create unique index if not exists offer_redemptions_one_per_order on public.offer_redemptions (order_id);
create index if not exists offer_redemptions_offer_status on public.offer_redemptions (offer_id, status, hold_until);
create index if not exists offer_redemptions_customer on public.offer_redemptions (project_id, customer_phone);

-- 5. Functions (service role only) -------------------------------
-- Live = confirmed, or held and not yet expired.
create or replace function public.shop_offer_counts(
  p_project_id uuid, p_offer_ids uuid[], p_phone text, p_exclude_order uuid)
returns table (offer_id uuid, used_total integer, used_by_customer integer)
language sql stable security definer set search_path = public
as $$
  select o.id,
    (select count(*)::int from offer_redemptions r
      where r.offer_id = o.id and r.order_id is distinct from p_exclude_order
        and (r.status = 'confirmed' or (r.status = 'held' and r.hold_until > now()))),
    (select count(*)::int from offer_redemptions r
      where r.offer_id = o.id and p_phone is not null and r.customer_phone = p_phone
        and r.order_id is distinct from p_exclude_order
        and (r.status = 'confirmed' or (r.status = 'held' and r.hold_until > now())))
  from offers o
  where o.project_id = p_project_id and o.id = any(p_offer_ids);
$$;

create or replace function public.shop_customer_has_prior_order(
  p_project_id uuid, p_phone text, p_exclude_order uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from orders o
     where o.project_id = p_project_id and o.phone_number = p_phone
       and o.id is distinct from p_exclude_order
       and o.status <> 'cancelled'
       -- A real order: paid / free / placed offline (confirmed or later), or
       -- one whose payment link can still be paid. An abandoned link (pending,
       -- link expired) does not cost the customer their first-order offer.
       and (o.payment_status in ('paid', 'underpaid', 'not_required')
            or o.status <> 'pending'
            or (o.payment_status = 'link_sent' and o.payment_link_expires_at > now())));
$$;

-- Authoritative claim. Idempotent per order (re-claim updates the row).
-- Returns {"ok":true,"redemption_id":uuid} or {"ok":false,"reason":<code>}.
create or replace function public.shop_claim_offer(
  p_order_id uuid, p_offer_id uuid, p_phone text, p_verified boolean,
  p_hold_until timestamptz, p_discount numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_order record;
  v_offer record;
  v_used  integer;
  v_mine  integer;
  v_id    uuid;
  v_now   timestamptz := now();
begin
  select id, project_id, phone_number into v_order from orders where id = p_order_id;
  if not found or v_order.phone_number is distinct from p_phone then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  -- Serialises every claim on this offer (usage_limit race).
  select * into v_offer from offers
   where id = p_offer_id and project_id = v_order.project_id
   for update;
  if not found or v_offer.archived_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;
  if not v_offer.is_active then
    return jsonb_build_object('ok', false, 'reason', 'paused');
  end if;
  if v_offer.starts_at is not null and v_now < v_offer.starts_at then
    return jsonb_build_object('ok', false, 'reason', 'not_started');
  end if;
  if v_offer.ends_at is not null and v_now >= v_offer.ends_at then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  -- Serialises this customer's claims (per-customer / first-order races).
  -- Lock order is always offer row -> customer lock, so no deadlock cycle.
  perform pg_advisory_xact_lock(hashtextextended(v_order.project_id::text || ':' || p_phone, 0));

  if (v_offer.per_customer_limit is not null or v_offer.first_order_only) and not p_verified then
    return jsonb_build_object('ok', false, 'reason', 'login_required');
  end if;

  select count(*) into v_used from offer_redemptions r
   where r.offer_id = p_offer_id and r.order_id <> p_order_id
     and (r.status = 'confirmed' or (r.status = 'held' and r.hold_until > v_now));
  if v_offer.usage_limit is not null and v_used >= v_offer.usage_limit then
    return jsonb_build_object('ok', false, 'reason', 'limit_reached');
  end if;

  if v_offer.per_customer_limit is not null then
    select count(*) into v_mine from offer_redemptions r
     where r.offer_id = p_offer_id and r.customer_phone = p_phone and r.order_id <> p_order_id
       and (r.status = 'confirmed' or (r.status = 'held' and r.hold_until > v_now));
    if v_mine >= v_offer.per_customer_limit then
      return jsonb_build_object('ok', false, 'reason', 'already_used');
    end if;
  end if;

  -- The second check closes the race of two first-order claims on two
  -- different orders before either is placed (placed_at is only set once a
  -- payment link exists): a live first-order redemption on another order of
  -- this customer counts too. The customer lock above serialises the two.
  if v_offer.first_order_only and (
    shop_customer_has_prior_order(v_order.project_id, p_phone, p_order_id)
    or exists (
      select 1 from offer_redemptions r join offers fo on fo.id = r.offer_id
       where r.project_id = v_order.project_id and r.customer_phone = p_phone
         and r.order_id <> p_order_id and fo.first_order_only
         and (r.status = 'confirmed' or (r.status = 'held' and r.hold_until > v_now)))) then
    return jsonb_build_object('ok', false, 'reason', 'not_first_order');
  end if;

  insert into offer_redemptions
    (project_id, offer_id, order_id, customer_phone, verified, status, hold_until, discount_amount)
  values
    (v_order.project_id, p_offer_id, p_order_id, p_phone, p_verified,
     case when p_hold_until is null then 'confirmed' else 'held' end,
     p_hold_until, round(coalesce(p_discount, 0), 2))
  on conflict (order_id) do update
    set project_id = excluded.project_id, offer_id = excluded.offer_id,
        customer_phone = excluded.customer_phone, verified = excluded.verified,
        status = excluded.status, hold_until = excluded.hold_until,
        discount_amount = excluded.discount_amount, updated_at = now()
  returning id into v_id;

  return jsonb_build_object('ok', true, 'redemption_id', v_id);
end $$;

create or replace function public.shop_confirm_offer(p_order_id uuid)
returns void language sql security definer set search_path = public
as $$
  -- Payment already taken: honour it even if the hold expired.
  update offer_redemptions set status = 'confirmed', hold_until = null, updated_at = now()
   where order_id = p_order_id and status = 'held';
$$;

create or replace function public.shop_release_offer(p_order_id uuid)
returns void language sql security definer set search_path = public
as $$
  update offer_redemptions set status = 'released', hold_until = null, updated_at = now()
   where order_id = p_order_id and status <> 'released';
$$;

create or replace function public.shop_offer_usage(p_project_id uuid)
returns table (offer_id uuid, confirmed_count integer, held_count integer, total_discount numeric)
language sql stable security definer set search_path = public
as $$
  select r.offer_id,
         count(*) filter (where r.status = 'confirmed')::int,
         count(*) filter (where r.status = 'held' and r.hold_until > now())::int,
         coalesce(sum(r.discount_amount) filter (where r.status = 'confirmed'), 0)
    from offer_redemptions r
   where r.project_id = p_project_id
   group by r.offer_id;
$$;

-- Non-incrementing check, so a blocked IP gets "rate limited" for EVERY
-- code (valid or not) and learns nothing. Blocked when count >= limit.
create or replace function public.peek_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select count >= p_limit from rate_limits
                    where key = p_key
                      and window_start >= now() - make_interval(secs => p_window_seconds)), false);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.shop_offer_counts(uuid, uuid[], text, uuid)',
    'public.shop_customer_has_prior_order(uuid, text, uuid)',
    'public.shop_claim_offer(uuid, uuid, text, boolean, timestamptz, numeric)',
    'public.shop_confirm_offer(uuid)',
    'public.shop_release_offer(uuid)',
    'public.shop_offer_usage(uuid)',
    'public.peek_rate_limit(text, integer, integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- 6. RLS: members read; all writes via backend service role -------
alter table public.offers enable row level security;
drop policy if exists "offers_member_read" on public.offers;
create policy "offers_member_read" on public.offers for select
  using (is_project_owner_or_active_member(auth.uid(), offers.project_id));

alter table public.offer_redemptions enable row level security;
drop policy if exists "offer_redemptions_member_read" on public.offer_redemptions;
create policy "offer_redemptions_member_read" on public.offer_redemptions for select
  using (is_project_owner_or_active_member(auth.uid(), offer_redemptions.project_id));
