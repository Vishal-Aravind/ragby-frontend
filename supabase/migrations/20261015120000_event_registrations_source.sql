-- Where a registration came from: flow, whatsapp_chat, website_chat, direct.
alter table public.event_registrations add column if not exists source text;
