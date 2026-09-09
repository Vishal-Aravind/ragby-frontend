-- ============================================================
-- Appointments: atomic slot booking, and a per-project timezone
-- ============================================================
-- Booking was a check-then-insert. create_appointment called
-- get_available_slots, then created a Google Calendar event, then inserted
-- the row — with nothing in between. Two customers clicking the same slot
-- both passed the check and both got confirmed, with two calendar events.
-- For a booking product that is the core correctness bug.
--
-- A plain unique index can't express this, because slot_capacity may be
-- greater than 1 and services have different durations, so conflicts are
-- interval overlaps rather than equal start times. book_appointment_slot
-- locks the project's settings row, recounts overlaps INSIDE that lock, and
-- either inserts or raises.
--
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Per-project timezone
-- ------------------------------------------------------------
-- "Asia/Kolkata" was a literal in three Google event payloads, with a
-- matching +5:30 shift in three more places. Default preserves exactly
-- today's behaviour for every existing project.
alter table appointment_settings
  add column if not exists timezone text not null default 'Asia/Kolkata';

-- ------------------------------------------------------------
-- 2. Supporting index for the overlap count
-- ------------------------------------------------------------
-- The count below runs inside a lock on every booking, so it must not be a
-- sequential scan.
create index if not exists appointments_project_date_status_idx
  on appointments (project_id, appointment_date, status);

-- ------------------------------------------------------------
-- 3. The atomic booking
-- ------------------------------------------------------------
-- Called with the service-role key from backend/appointments.py, which has
-- already resolved the service and validated the slot against working
-- hours, buffers and Google's busy list. This function is the last word on
-- one question only: is there still capacity for this interval?
--
-- Returns the inserted row. Raises 'slot_taken' if not.
create or replace function book_appointment_slot(
  p_project_id   uuid,
  p_row          jsonb,
  p_start_time   text,
  p_end_time     text,
  p_date         text,
  p_reschedule_id uuid default null
)
returns appointments
language plpgsql
as $$
declare
  v_capacity int;
  v_overlaps int;
  v_row      appointments;
begin
  -- Lock the project's settings row. Any other booking for this project
  -- queues behind us, which is what makes the count below trustworthy.
  select coalesce(slot_capacity, 1) into v_capacity
  from appointment_settings
  where project_id = p_project_id
  for update;

  if v_capacity is null then
    raise exception 'settings_not_found';
  end if;

  -- Interval overlap, not equal start times: a 60-minute booking at 10:00
  -- and a 30-minute one at 10:15 collide without sharing a start time.
  -- Mirrors generate_slots' own overlap logic in backend/appointments.py.
  select count(*) into v_overlaps
  from appointments a
  where a.project_id = p_project_id
    and a.appointment_date = p_date
    and a.status in ('confirmed', 'pending_payment')
    and (p_reschedule_id is null or a.id <> p_reschedule_id)
    and a.start_time < p_end_time
    and a.end_time   > p_start_time;

  if v_overlaps >= v_capacity then
    raise exception 'slot_taken';
  end if;

  -- Releasing the original happens in the SAME transaction as inserting the
  -- replacement. It used to be marked rescheduled first, so a failure in
  -- between left the customer with neither booking.
  if p_reschedule_id is not null then
    update appointments set status = 'rescheduled' where id = p_reschedule_id;
  end if;

  insert into appointments select * from jsonb_populate_record(null::appointments, p_row)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function book_appointment_slot(uuid, jsonb, text, text, text, uuid) from public, anon;
grant execute on function book_appointment_slot(uuid, jsonb, text, text, text, uuid) to service_role;
