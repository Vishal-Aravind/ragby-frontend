-- GST tax invoices for shop orders.
--
-- * Seller details for the invoice: on the shop (shop_config) with an
--   optional per-branch override (empty = use the shop's).
-- * Each order gets at most ONE invoice number, issued when it is paid or
--   confirmed: INV/<FY>/<seq>, sequential per project per Indian financial
--   year (Apr-Mar, IST). Allocated by shop_issue_invoice() below, which locks
--   the order row and the counter row in one transaction: no gaps from
--   races, and a second call returns the number already issued.
-- * seller_snapshot freezes the seller details at issue time, so later
--   settings edits never change an old invoice.
-- Idempotent: safe to run more than once.

-- 1. Seller details -------------------------------------------------
alter table public.shop_config add column if not exists legal_name text;
alter table public.shop_config add column if not exists gstin text;
alter table public.shop_config add column if not exists registered_address text;
alter table public.shop_config add column if not exists state text;

alter table public.shop_branches add column if not exists gstin text;
alter table public.shop_branches add column if not exists legal_name text;
alter table public.shop_branches add column if not exists registered_address text;
alter table public.shop_branches add column if not exists state text;

-- 2. Invoice columns on orders --------------------------------------
alter table public.orders add column if not exists invoice_number text;
alter table public.orders add column if not exists invoice_date timestamptz;
alter table public.orders add column if not exists seller_snapshot jsonb;

create unique index if not exists orders_project_invoice_number_key
  on public.orders (project_id, invoice_number)
  where invoice_number is not null;

-- 3. Counter: one row per project per financial year ----------------
create table if not exists public.shop_invoice_counters (
  project_id uuid not null references public.projects(id) on delete cascade,
  fy text not null,                      -- '2026-27'
  last_no integer not null default 0 check (last_no >= 0),
  updated_at timestamptz not null default now(),
  primary key (project_id, fy)
);

-- Service role only: no policies, so anon/authenticated see nothing.
alter table public.shop_invoice_counters enable row level security;
revoke all on table public.shop_invoice_counters from public, anon, authenticated;
grant all on table public.shop_invoice_counters to service_role;

-- 4. Issue (or return the existing) invoice number ------------------
create or replace function public.shop_issue_invoice(p_order_id uuid, p_snapshot jsonb)
returns table (out_invoice_number text, out_invoice_date timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_project uuid;
  v_status text;
  v_number text;
  v_date timestamptz;
  v_now timestamptz := now();
  v_ist timestamp;
  v_start integer;
  v_fy text;
  v_no integer;
begin
  -- Locks the order: two concurrent calls for the same order serialize
  -- here, and the second one sees the first one's number.
  select o.project_id, o.status, o.invoice_number, o.invoice_date
    into v_project, v_status, v_number, v_date
    from orders o where o.id = p_order_id for update;
  if not found then
    return;
  end if;
  if v_number is not null then
    return query select v_number, v_date;
    return;
  end if;
  if v_status = 'cancelled' then
    return;                              -- never number a cancelled order
  end if;

  -- Indian financial year, by the date in India.
  v_ist := v_now at time zone 'Asia/Kolkata';
  v_start := extract(year from v_ist)::int - case when extract(month from v_ist) < 4 then 1 else 0 end;
  v_fy := v_start::text || '-' || lpad(((v_start + 1) % 100)::text, 2, '0');

  insert into shop_invoice_counters as c (project_id, fy, last_no, updated_at)
  values (v_project, v_fy, 1, v_now)
  on conflict (project_id, fy)
  do update set last_no = c.last_no + 1, updated_at = v_now
  returning c.last_no into v_no;

  v_number := 'INV/' || v_fy || '/' ||
              case when v_no < 10000 then lpad(v_no::text, 4, '0') else v_no::text end;

  update orders
     set invoice_number = v_number, invoice_date = v_now, seller_snapshot = p_snapshot
   where id = p_order_id;

  return query select v_number, v_now;
end;
$$;

revoke all on function public.shop_issue_invoice(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.shop_issue_invoice(uuid, jsonb) to service_role;
