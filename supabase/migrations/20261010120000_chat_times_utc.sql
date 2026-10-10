-- chats.created_at and chat_messages.created_at were "timestamp without time
-- zone". Every value in them is UTC (default now() on a UTC server, and
-- WhatsApp times written as +00:00), but the API returned them with no
-- timezone, so browsers read them as local time: 5h30 early in India.
--
-- Convert both to timestamptz, reading the stored values as UTC. The
-- moments don't change; they just carry their timezone from now on, like
-- every other *_at column in the schema.
alter table public.chat_messages
  alter column created_at type timestamptz using created_at at time zone 'UTC';

alter table public.chats
  alter column created_at type timestamptz using created_at at time zone 'UTC';
