-- WhatsApp flows: answers to "Ask a question" nodes, used later in messages
-- as {{variable}}. Their own column rather than `metadata`, which the shop and
-- booking steps overwrite. Lives as long as the session (2 hours idle).
-- Safe to re-run.
alter table whatsapp_sessions add column if not exists variables jsonb not null default '{}'::jsonb;
alter table whatsapp_sessions drop constraint if exists whatsapp_sessions_variables_size;
alter table whatsapp_sessions add constraint whatsapp_sessions_variables_size check (pg_column_size(variables) < 16384);
