-- ============================================================
-- Appointments: approval, change cut-off, location and a note
-- ============================================================
-- requires_approval (service): a booking starts as 'pending_approval' and
-- holds its slot until the owner approves or declines it.
-- cancel_cutoff_hours (project, and per service): customers can't cancel or
-- reschedule closer than this many hours before the appointment.
-- location, confirmation_note (service): shown in the confirmation.
--
-- Run after 20261103120000_appointment_flexible_slots.sql. Safe to re-run.
-- ============================================================
alter table appointment_services
  add column if not exists requires_approval boolean not null default false,
  add column if not exists location text check (location is null or char_length(location) <= 300),
  add column if not exists confirmation_note text check (confirmation_note is null or char_length(confirmation_note) <= 500),
  add column if not exists cancel_cutoff_hours integer
    check (cancel_cutoff_hours is null or cancel_cutoff_hours between 0 and 720);

alter table appointment_settings
  add column if not exists cancel_cutoff_hours integer
    check (cancel_cutoff_hours is null or cancel_cutoff_hours between 0 and 720);

-- Two new statuses
do $$
declare con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'appointments'::regclass and c.contype = 'c'
      and exists (
        select 1 from unnest(c.conkey) as colnum
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = colnum
        where a.attname = 'status'
      )
  loop
    execute format('alter table appointments drop constraint %I', con.conname);
  end loop;
end $$;

alter table appointments add constraint appointments_status_check
  check (status in ('confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show', 'pending_payment',
                    'pending_approval', 'declined', 'expired', 'payment_conflict'));

-- A request waiting for approval holds its slot, like a confirmed booking
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
  v_json     jsonb;
  v_cols     text;
begin
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
    and a.status in ('confirmed', 'pending_payment', 'pending_approval')
    and (p_reschedule_id is null or a.id <> p_reschedule_id)
    and a.start_time::time < p_end_time::time
    and a.end_time::time   > p_start_time::time;

  if v_overlaps >= v_capacity then
    raise exception 'slot_taken';
  end if;

  if p_reschedule_id is not null then
    update appointments set status = 'rescheduled' where id = p_reschedule_id;
  end if;

  -- Insert only the columns we were given (plus these defaults), so every
  -- other column keeps its own default instead of being set to NULL.
  v_json := jsonb_build_object('id', gen_random_uuid(), 'created_at', now(),
                               'reminder_sent', false, 'reminder_stage', 0) || p_row;
  select string_agg(quote_ident(k), ', ') into v_cols
  from jsonb_object_keys(v_json) as k
  where exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'appointments' and column_name = k);

  execute format(
    'insert into appointments (%1$s) select %1$s from jsonb_populate_record(null::appointments, $1) returning *',
    v_cols)
  into v_row using v_json;

  return v_row;
end;
$$;
