-- Per event: send the WhatsApp confirmation as the approved
-- "event_registration" template (reaches people who register from the
-- website link). Off: only people who came through WhatsApp (flows, AI chat)
-- get the plain-text confirmation, which WhatsApp delivers only inside its
-- 24-hour window. Off by default, so no template is sent unless chosen.
alter table public.events
  add column if not exists send_wa_confirmation boolean not null default false;
