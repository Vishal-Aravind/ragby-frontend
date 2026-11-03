-- ============================================================
-- Appointments: Calendly-style schedules and service options
-- ============================================================
-- appointment_schedules: named weekly hours + date-specific hours
-- ("Clinic hours", "Evening hours"). Each service picks one; no pick =
-- the project's default schedule. Every project gets a default copied
-- from its current appointment_settings hours.
--
-- appointment_services gains: its schedule, its own booking window
-- (next N days / a date range / no end), its own daily limit, a hidden
-- flag (only reachable by its direct link) and booking questions.
-- appointments.answers keeps what the customer answered.
--
-- Run after 20261103120000_appointment_flexible_slots.sql. Safe to re-run.
-- ============================================================

create table if not exists appointment_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  is_default boolean not null default false,
  working_hours jsonb not null default '{}'::jsonb,
  date_overrides jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists appointment_schedules_project_idx on appointment_schedules (project_id);
create unique index if not exists appointment_schedules_one_default
  on appointment_schedules (project_id) where is_default;

-- Backend (service role) only, like appointment_services.
alter table appointment_schedules enable row level security;

insert into appointment_schedules (project_id, name, is_default, working_hours, date_overrides)
select s.project_id, 'Working hours', true,
       coalesce(s.working_hours, '{}'::jsonb), coalesce(s.date_overrides, '[]'::jsonb)
from appointment_settings s
where not exists (select 1 from appointment_schedules x where x.project_id = s.project_id);

alter table appointment_services
  add column if not exists schedule_id uuid references appointment_schedules(id) on delete set null,
  add column if not exists booking_window_type text
    check (booking_window_type is null or booking_window_type in ('rolling', 'range', 'indefinite')),
  add column if not exists booking_window_days integer
    check (booking_window_days is null or booking_window_days between 1 and 730),
  add column if not exists booking_window_start date,
  add column if not exists booking_window_end date,
  add column if not exists max_per_day integer
    check (max_per_day is null or max_per_day between 1 and 1000),
  add column if not exists is_hidden boolean not null default false,
  add column if not exists questions jsonb not null default '[]'::jsonb;

alter table appointments add column if not exists answers jsonb;
