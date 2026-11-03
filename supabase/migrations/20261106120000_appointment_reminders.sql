-- ============================================================
-- Appointments: several reminders per booking, with an on/off switch
-- ============================================================
-- reminders_enabled: master switch for customer reminders.
-- reminder_offsets: hours before the appointment, e.g. [24, 2]. Empty =
-- the single reminder_hours value, as before.
-- appointments.reminder_stage: how many of those reminders (largest first)
-- have been handled for a booking. reminder_sent stays the "all done" flag,
-- so existing rows keep working.
--
-- Safe to re-run.
-- ============================================================
alter table appointment_settings
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists reminder_offsets jsonb not null default '[]'::jsonb;

alter table appointments
  add column if not exists reminder_stage integer not null default 0;
