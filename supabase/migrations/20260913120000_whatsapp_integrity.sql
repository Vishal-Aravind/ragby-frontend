-- ============================================================
-- WhatsApp: per-project token, one project per number, bounded dedup
-- ============================================================
-- Four gaps found by a dedicated audit of backend/whatsapp.py.
--
-- 1. Onboarding obtains a real per-merchant access token from Meta, uses it
--    for the onboarding calls, and then throws it away — the upsert wrote
--    only project_id, phone_number_id, waba_id, display_phone_number. So
--    every runtime send for every tenant went out on the single global
--    WHATSAPP_TOKEN: one leaked env var meant send-as-any-merchant, and a
--    merchant revoking our access had no effect whatsoever.
--
-- 2. whatsapp_onboard checks for another project already holding a
--    phone_number_id, then upserts on_conflict="project_id". Two projects
--    onboarding the same number concurrently BOTH pass the check and BOTH
--    rows persist, because the conflict target is the project, not the
--    number. _process_webhook then resolves the tenant by phone_number_id
--    and took an arbitrary first row — so a share of one merchant's real
--    customer conversations would be delivered to another. No unique
--    constraint on phone_number_id existed anywhere.
--
-- 3. Meta's delivery status callbacks were discarded before the project was
--    even resolved, so a failed send was invisible. Recording the reason
--    needs somewhere to put it.
--
-- 4. whatsapp_webhook_dedup holds one row per WhatsApp message ever
--    received and nothing has ever deleted from it.
--
-- Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Per-project access token
-- ------------------------------------------------------------
-- Nullable on purpose: rows written before this column existed have no
-- token, and the send paths fall back to the global WHATSAPP_TOKEN for
-- exactly those. An existing connection keeps working untouched and
-- upgrades the next time it is reconnected. See _token_for in whatsapp.py.
alter table whatsapp_integrations
  add column if not exists access_token text;


-- ------------------------------------------------------------
-- 2. One project per WhatsApp number
-- ------------------------------------------------------------
-- phone_number_id is NOT NULL on this table, so no partial clause is
-- needed. Verified clean against the deployed database before writing
-- this: no number is currently bound to more than one project, so the
-- index creates with no cleanup step.
--
-- If this ever fails with a uniqueness violation, two projects are bound
-- to one number and their conversations are being split. That must be
-- resolved by hand — decide which project genuinely owns the number and
-- disconnect the other.
create unique index if not exists whatsapp_integrations_phone_number_id_uniq
  on whatsapp_integrations (phone_number_id);


-- ------------------------------------------------------------
-- 3. Somewhere to record a delivery failure
-- ------------------------------------------------------------
-- The common causes are all invisible today: the number is not on
-- WhatsApp, the template was rejected, the 24-hour customer service window
-- has closed, or Meta has flagged the number. The send helpers only print
-- the error and their callers discard the response, so the dashboard
-- showed a refused message as delivered.
alter table chats
  add column if not exists last_send_error text;

alter table chats
  add column if not exists last_send_error_at timestamptz;


-- ------------------------------------------------------------
-- 4. Bound the dedup table
-- ------------------------------------------------------------
-- Rows are only useful while Meta might still redeliver. Called
-- opportunistically from backend/whatsapp.py rather than on a cron — the
-- same approach prune_webhook_dedup uses for the newer generic table.
create index if not exists whatsapp_webhook_dedup_created_at_idx
  on whatsapp_webhook_dedup (created_at);

create or replace function prune_whatsapp_webhook_dedup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from whatsapp_webhook_dedup where created_at < now() - interval '7 days';
$$;
