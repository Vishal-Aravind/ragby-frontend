-- ============================================================
-- Paid appointments — per-service price + payment_mode, appointment
-- payment tracking, reuses the Razorpay Partner OAuth connection from
-- 20260810120000_razorpay_partner_oauth.sql (same as Shop's payments).
-- ============================================================
-- payment_mode is per SERVICE (appointment_services), not project-wide —
-- a project can offer both a free consultation and a paid session.
--   'free'           — no payment involved (default; matches every
--                       existing service after this migration, so this is
--                       a zero-behavior-change deploy).
--   'hold_to_confirm' — booking is provisional (status='pending_payment')
--                       until paid; unpaid holds auto-expire, see
--                       appointments.py's HOLD_MINUTES / release_expired_holds.
--   'request_after'   — booking confirms immediately, payment requested
--                       as a non-blocking follow-up.
--
-- appointments.payment_status mirrors orders.payment_status's vocabulary,
-- with 'not_required' added for free bookings (orders has no free-order
-- concept, so it never needed this value). payment_id is the Razorpay
-- Payment Link id — also the unified webhook's lookup key across both
-- orders and appointments (see shop.py's razorpay_webhook).
--
-- appointments.status gains two new values used by app code:
-- 'pending_payment' (an unpaid hold) and 'expired' (a hold that timed out
-- unpaid — kept distinct from customer-initiated 'cancelled' so reporting
-- can tell the two apart). The status column predates this repo's tracked
-- migrations, so any existing CHECK constraint on it can't be read from
-- migration history — the DO block below finds and replaces whatever (if
-- any) constraint currently exists by inspecting the live catalog, rather
-- than assuming a specific constraint name.
--
-- Safe to re-run.
-- ============================================================

alter table appointment_services add column if not exists price numeric(10,2) not null default 0;
alter table appointment_services add column if not exists payment_mode text not null default 'free';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'appointment_services'::regclass
      and conname = 'appointment_services_payment_mode_check'
  ) then
    alter table appointment_services add constraint appointment_services_payment_mode_check
      check (payment_mode in ('free', 'hold_to_confirm', 'request_after'));
  end if;
end $$;

alter table appointments add column if not exists payment_status text not null default 'not_required';
alter table appointments add column if not exists payment_id text;
alter table appointments add column if not exists hold_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'appointments'::regclass
      and conname = 'appointments_payment_status_check'
  ) then
    alter table appointments add constraint appointments_payment_status_check
      check (payment_status in ('not_required', 'unpaid', 'link_sent', 'paid'));
  end if;
end $$;

-- Replace any existing CHECK on appointments.status specifically (predates
-- tracked migrations, exact name unknown) with one that also allows the
-- two new values this feature introduces. Matched via conkey/pg_attribute
-- on the exact column name 'status' — NOT a text search on the
-- constraint's definition, which would also false-positive-match the
-- payment_status check constraint just added above (its definition
-- literally contains the substring "status").
do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'appointments'::regclass
      and c.contype = 'c'
      and exists (
        select 1
        from unnest(c.conkey) as colnum
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = colnum
        where a.attname = 'status'
      )
  loop
    execute format('alter table appointments drop constraint %I', con.conname);
  end loop;
end $$;

-- 'payment_conflict' — a paid hold whose slot got taken by someone else in
-- the rare window between the hold expiring and the payment webhook
-- arriving; flagged for manual ops resolution rather than auto-refunded
-- (see appointments.py's handle_appointment_payment_paid).
alter table appointments add constraint appointments_status_check
  check (status in ('confirmed', 'cancelled', 'rescheduled', 'completed', 'pending_payment', 'expired', 'payment_conflict'));

create index if not exists appointments_hold_expiry_idx
  on appointments (status, hold_expires_at) where status = 'pending_payment';
