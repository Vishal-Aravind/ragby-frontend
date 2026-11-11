-- ============================================================
-- Events: optional paid registration
-- ============================================================
-- events.price: ticket price; null or 0 = free (as before).
-- event_registrations: payment fields. A paid registration waits as
-- 'pending_payment' (holding its seat) until Razorpay confirms it, or is
-- cancelled with payment_status 'expired' after the hold. Seat counts and
-- the duplicate index already treat every non-cancelled row as a seat, so
-- register_for_event_atomic needs no change.
--
-- Safe to re-run.
-- ============================================================
alter table events
  add column if not exists price numeric(12,2)
    check (price is null or (price >= 0 and price <= 1000000));

alter table event_registrations
  add column if not exists payment_id text,
  add column if not exists payment_status text,
  add column if not exists amount numeric(12,2),
  add column if not exists hold_expires_at timestamptz;

create index if not exists event_registrations_payment_id_idx
  on event_registrations (payment_id) where payment_id is not null;
create index if not exists event_registrations_pending_hold_idx
  on event_registrations (hold_expires_at) where status = 'pending_payment';

-- Allow the new 'pending_payment' status if the table restricts statuses.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.event_registrations'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table event_registrations drop constraint %I', c.conname);
  end loop;
end $$;

alter table event_registrations
  add constraint event_registrations_status_check
  check (status in ('confirmed', 'pending_payment', 'attended', 'no_show', 'cancelled'));
