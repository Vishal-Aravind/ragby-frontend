-- ============================================================
-- Appointments: Calendly-style flexible availability
-- ============================================================
-- Project level: date-specific hours (holidays, one-off changes), buffer
-- before, a fixed start-time interval, minimum notice, bookings per day.
-- Service level (all optional, empty = use the project setting): capacity,
-- start interval, buffers, minimum notice, hand-picked start times.
-- Several time ranges a day live inside the existing working_hours json.
--
-- book_appointment_slot also takes the service's capacity now.
--
-- Safe to re-run.
-- ============================================================
alter table appointment_settings
  add column if not exists date_overrides jsonb not null default '[]'::jsonb,
  add column if not exists buffer_before_minutes integer not null default 0
    check (buffer_before_minutes between 0 and 240),
  add column if not exists slot_interval_minutes integer
    check (slot_interval_minutes is null or slot_interval_minutes between 5 and 720),
  add column if not exists min_notice_minutes integer not null default 0
    check (min_notice_minutes between 0 and 43200),
  add column if not exists max_per_day integer
    check (max_per_day is null or max_per_day between 1 and 1000);

alter table appointment_services
  add column if not exists slot_capacity integer
    check (slot_capacity is null or slot_capacity between 1 and 100),
  add column if not exists slot_interval_minutes integer
    check (slot_interval_minutes is null or slot_interval_minutes between 5 and 720),
  add column if not exists buffer_before_minutes integer
    check (buffer_before_minutes is null or buffer_before_minutes between 0 and 240),
  add column if not exists buffer_after_minutes integer
    check (buffer_after_minutes is null or buffer_after_minutes between 0 and 240),
  add column if not exists min_notice_minutes integer
    check (min_notice_minutes is null or min_notice_minutes between 0 and 43200),
  add column if not exists fixed_times jsonb;

drop function if exists book_appointment_slot(uuid, jsonb, text, text, text, uuid);

create or replace function book_appointment_slot(
  p_project_id   uuid,
  p_row          jsonb,
  p_start_time   text,
  p_end_time     text,
  p_date         text,
  p_reschedule_id uuid default null,
  p_capacity     integer default null
)
returns appointments
language plpgsql
as $$
declare
  v_capacity int;
  v_overlaps int;
  v_row      appointments;
begin
  -- Lock the project's settings row so concurrent bookings queue up.
  select coalesce(p_capacity, slot_capacity, 1) into v_capacity
  from appointment_settings
  where project_id = p_project_id
  for update;

  if v_capacity is null then
    raise exception 'settings_not_found';
  end if;

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

revoke all on function book_appointment_slot(uuid, jsonb, text, text, text, uuid, integer) from public, anon;
grant execute on function book_appointment_slot(uuid, jsonb, text, text, text, uuid, integer) to service_role;
