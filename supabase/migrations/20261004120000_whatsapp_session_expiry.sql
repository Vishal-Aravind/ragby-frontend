-- WhatsApp flow sessions never expired: flows.get_session already deletes a
-- session past expires_at, but nothing ever set it, so a customer left in AI
-- mode was still in AI mode hours or days later. upsert_session now sets
-- expires_at = now() + 2 hours on every step; this makes sure the column
-- exists. Safe to re-run.
alter table whatsapp_sessions add column if not exists expires_at timestamptz;
