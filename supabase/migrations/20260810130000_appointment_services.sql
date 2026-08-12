-- ============================================================
-- Multi-service appointments (Calendly-style "event types")
-- ============================================================
-- Replaces the single global service_name/duration_minutes on
-- appointment_settings with a real list of services per project — each
-- with its own name, duration, and (added in a later migration) price and
-- payment_mode. appointment_settings keeps working_hours/buffer_minutes/
-- slot_capacity/advance_booking_days/reminder_hours/google_calendar_id —
-- these stay project-level (one shared calendar/capacity pool across every
-- service of a project), only name/duration move to per-service.
--
-- appointment_settings.service_name/duration_minutes are deliberately left
-- in place, unused going forward — dropping them is a later cleanup
-- decision, not this migration's job (same conservative pattern as
-- shop_config.razorpay_key_id/secret).
--
-- Backfill is idempotent — every existing project gets exactly one
-- 'default' service reproducing today's single-service behavior exactly,
-- and every existing appointment gets linked to it. Net effect: zero
-- behavior change for any project immediately after this migration.
--
-- Safe to re-run.
-- ============================================================

create table if not exists appointment_services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null default 30,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointment_services_project_idx
  on appointment_services (project_id);

alter table appointment_settings add column if not exists currency_code text not null default 'INR';

alter table appointments add column if not exists service_id uuid references appointment_services(id) on delete set null;

-- Backfill: one service per existing appointment_settings row, copying its
-- service_name/duration_minutes. Guarded so re-running this file never
-- creates a second default service for a project that already has one.
insert into appointment_services (project_id, name, duration_minutes, is_active, sort_order)
select
  s.project_id,
  coalesce(nullif(trim(s.service_name), ''), 'Appointment'),
  coalesce(s.duration_minutes, 30),
  true,
  0
from appointment_settings s
where not exists (
  select 1 from appointment_services x where x.project_id = s.project_id
);

-- Backfill: link every existing appointment to its project's one (and, at
-- backfill time, only) service — unambiguous, since there was only ever
-- one service per project before this migration.
update appointments a
set service_id = (
  select id from appointment_services x
  where x.project_id = a.project_id
  order by x.created_at asc
  limit 1
)
where a.service_id is null;
