-- ============================================================
-- Event registrations: atomic registration, and a duplicate backstop
-- ============================================================
-- register_for_event_core did capacity and duplicate-phone as two separate
-- check-then-insert steps with nothing atomic between them:
--
--   * Two concurrent submits from the same phone both passed the duplicate
--     check and both inserted. Each duplicate fired its own WhatsApp
--     confirmation, so the merchant paid twice for one registration.
--
--   * The duplicate check used .maybe_single(), which RAISES on more than
--     one row. So once that race had fired even once, every later attempt
--     by that phone for that event threw a non-ValueError the route did not
--     catch — a permanent 500 on a path that should have said "you are
--     already registered".
--
--   * Capacity was counted, then inserted against, so a popular event
--     oversold past its limit.
--
-- Same class of bug, and the same fix, as
-- 20260909150000_appointment_booking_atomic.sql.
--
-- Note there is no CREATE TABLE migration in this repo for events,
-- event_registrations or form_submissions — they were created out of band.
-- This file adds constraints and a function only; it does not attempt to
-- reconstruct the tables.
--
-- Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Supporting index
-- ------------------------------------------------------------
-- The capacity count and the duplicate lookup both run inside a lock on
-- every registration, so neither may be a sequential scan.
create index if not exists event_registrations_event_status_idx
  on event_registrations (event_id, status);


-- ------------------------------------------------------------
-- 2. The duplicate backstop
-- ------------------------------------------------------------
-- Partial so that someone who cancels can register again, which is the
-- behaviour the app already describes. phone is NOT NULL on this table, so
-- no null guard is needed; event_id IS nullable, and nulls never collide
-- in a unique index, which is the correct outcome for an orphaned row.
--
-- Verified clean before writing this: the table is empty, so the index
-- creates without any cleanup. If it ever fails with a uniqueness
-- violation, duplicates exist and must be collapsed by hand — deciding
-- which of two real registrations to keep is not something a migration
-- should do silently.
create unique index if not exists event_registrations_event_phone_uniq
  on event_registrations (event_id, phone)
  where status is distinct from 'cancelled';


-- ------------------------------------------------------------
-- 3. The atomic registration
-- ------------------------------------------------------------
-- Called with the service-role key from backend/events.py, which has
-- already validated the phone, bounded the free-text fields, and confirmed
-- the event is active and inside its deadline. This function is the last
-- word on two questions only, both of which must be answered under a lock:
-- is there still capacity, and is this phone already registered?
--
-- Returns jsonb rather than raising, so the caller can map each refusal to
-- its own customer-facing message without parsing exception text:
--   {"status":"ok","registration":{...}}
--   {"status":"full"}
--   {"status":"duplicate"}
--   {"status":"closed"}
create or replace function register_for_event_atomic(
  p_event_id   uuid,
  p_project_id uuid,
  p_name       text,
  p_phone      text,
  p_email      text default null,
  p_notes      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity   int;
  v_is_active  boolean;
  v_registered int;
  v_row        event_registrations;
begin
  -- Lock the event row. Any other registration for this event queues
  -- behind us, which is what makes the two checks below trustworthy.
  select capacity, is_active
    into v_capacity, v_is_active
  from events
  where id = p_event_id and project_id = p_project_id
  for update;

  if not found then
    return jsonb_build_object('status', 'closed');
  end if;

  -- Re-checked inside the lock: the merchant may have switched the event
  -- off between the caller's read and this call.
  if not coalesce(v_is_active, false) then
    return jsonb_build_object('status', 'closed');
  end if;

  -- Duplicate before capacity, so someone re-submitting a form they have
  -- already completed is told they are registered rather than told the
  -- event is full.
  if exists (
    select 1 from event_registrations
    where event_id = p_event_id
      and phone = p_phone
      and status is distinct from 'cancelled'
  ) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- capacity is nullable, and 0 has always meant "no limit" to the callers
  -- that test it for truthiness. Preserved deliberately rather than
  -- quietly changing what an existing 0-capacity event does.
  if v_capacity is not null and v_capacity > 0 then
    select count(*) into v_registered
    from event_registrations
    where event_id = p_event_id
      and status is distinct from 'cancelled';

    if v_registered >= v_capacity then
      return jsonb_build_object('status', 'full');
    end if;
  end if;

  insert into event_registrations (event_id, project_id, name, phone, email, notes)
  values (p_event_id, p_project_id, p_name, p_phone, p_email, p_notes)
  returning * into v_row;

  return jsonb_build_object('status', 'ok', 'registration', to_jsonb(v_row));
end;
$$;
