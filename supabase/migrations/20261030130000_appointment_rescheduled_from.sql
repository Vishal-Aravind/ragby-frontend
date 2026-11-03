-- A reschedule creates a new row and marks the old one 'rescheduled'. This
-- links them, so the dashboard can show one booking with its history.
-- Safe to re-run.
alter table appointments
  add column if not exists rescheduled_from uuid references appointments(id) on delete set null;
