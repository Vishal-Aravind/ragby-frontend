-- ============================================================
-- Appointments: book_appointment_slot failed on every booking
-- ============================================================
-- 1. appointment_date is a date but p_date is text, so the overlap count
--    raised "operator does not exist: date = text". Both sides of the date
--    and time comparisons are now cast explicitly.
-- 2. Inserting jsonb_populate_record(null::appointments, ...) writes NULL
--    into every column missing from p_row, which skips column defaults
--    (id, created_at, reminder_sent - the reminder job only picks up
--    false, not NULL). They are now filled in; keys that are not columns
--    are ignored by jsonb_populate_record.
--
-- Safe to re-run.
-- ============================================================
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
  select count(*) into v_overlaps
  from appointments a
  where a.project_id = p_project_id
    and a.appointment_date::date = p_date::date
    and a.status in ('confirmed', 'pending_payment')
    and (p_reschedule_id is null or a.id <> p_reschedule_id)
    and a.start_time::time < p_end_time::time
    and a.end_time::time   > p_start_time::time;

  if v_overlaps >= v_capacity then
    raise exception 'slot_taken';
  end if;

  -- Releasing the original happens in the SAME transaction as inserting the
  -- replacement.
  if p_reschedule_id is not null then
    update appointments set status = 'rescheduled' where id = p_reschedule_id;
  end if;

  insert into appointments
  select * from jsonb_populate_record(
    null::appointments,
    jsonb_build_object('id', gen_random_uuid(), 'created_at', now(), 'reminder_sent', false) || p_row
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function book_appointment_slot(uuid, jsonb, text, text, text, uuid) from public, anon;
grant execute on function book_appointment_slot(uuid, jsonb, text, text, text, uuid) to service_role;
