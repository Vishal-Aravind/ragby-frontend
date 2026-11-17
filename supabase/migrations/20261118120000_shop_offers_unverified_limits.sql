-- ============================================================
-- Offers: count per-customer limits against the order's phone,
-- verified or not
-- ============================================================
-- Website buyers type their phone number instead of arriving through a
-- signed WhatsApp link, so they are "unverified". Until now any offer
-- with per_customer_limit or first_order_only refused them outright
-- ('login_required'), which made those offers unusable on the website
-- even though the order itself goes through and is paid for.
--
-- Everything downstream in this function already counts against
-- p_phone (and is serialised by the advisory lock on project+phone),
-- so the only change needed is to stop requiring p_verified and
-- instead require that we have a phone number at all. A typed number
-- is weaker than a verified one — someone determined can type a fresh
-- one to re-claim a first-order discount — which is the accepted
-- trade-off for letting these offers work outside WhatsApp. The
-- redemption row still records `verified`, so the two can be told
-- apart later.
--
-- Only the one check changes; the rest of the body is reproduced
-- unchanged because `create or replace` needs the whole definition.
-- Safe to re-run.
-- ============================================================
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

  -- Changed: a phone number is what these limits count against, so any
  -- order carrying one qualifies. Without one there is nothing to count.
  if (v_offer.per_customer_limit is not null or v_offer.first_order_only)
     and coalesce(p_phone, '') = '' then
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
