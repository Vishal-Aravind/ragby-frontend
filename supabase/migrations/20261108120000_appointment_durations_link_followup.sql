-- ============================================================
-- Appointments: several lengths per service, a custom booking link,
-- and a follow-up message after the appointment
-- ============================================================
-- appointment_services.duration_options: extra lengths the customer can
-- choose (minutes), next to the service's own duration.
-- appointment_settings.booking_slug: the short link name (/book/clinic).
-- old_slugs: earlier names, so shared links keep working after a rename.
-- followup_*: an optional WhatsApp message some hours after the visit.
-- appointments.followup_sent: so each booking gets it only once.
--
-- Safe to re-run.
-- ============================================================
alter table appointment_services
  add column if not exists duration_options jsonb;

alter table appointment_settings
  add column if not exists booking_slug text
    check (booking_slug is null or booking_slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  add column if not exists old_slugs text[] not null default '{}',
  add column if not exists followup_enabled boolean not null default false,
  add column if not exists followup_hours integer not null default 2
    check (followup_hours between 1 and 72),
  add column if not exists followup_message text
    check (followup_message is null or char_length(followup_message) <= 200);

create unique index if not exists appointment_settings_booking_slug_key
  on appointment_settings (booking_slug) where booking_slug is not null;

alter table appointments
  add column if not exists followup_sent boolean not null default false;
