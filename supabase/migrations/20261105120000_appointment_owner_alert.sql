-- ============================================================
-- Appointments: WhatsApp alert to the owner when someone books
-- ============================================================
-- notify_owner_booking: the on/off switch (on by default; nothing is sent
-- until a phone is set). owner_phone: full number with country code, digits
-- only. owner_phone_code: the country-code part, so the dashboard can show
-- the code and the number in two boxes.
--
-- Safe to re-run.
-- ============================================================
alter table appointment_settings
  add column if not exists notify_owner_booking boolean not null default true,
  add column if not exists owner_phone text,
  add column if not exists owner_phone_code text;
