-- ============================================================
-- Campaigns: idempotent creation, and a dispatcher that can find work
-- ============================================================
-- Creating a campaign had no idempotency key at all. A double-click, or a
-- browser retry after a timeout, created a SECOND campaign and sent a
-- WhatsApp template — billed by Meta — to every recipient twice. There is
-- no undo for that.
--
-- client_token is minted once per form session by CampaignsTab.js and sent
-- with the create request. The unique index turns a repeat submit into a
-- duplicate-key error, which backend/campaigns.py catches and answers with
-- the ORIGINAL campaign instead of starting a new send.
--
-- Safe to re-run.
-- ============================================================

alter table campaigns
  add column if not exists client_token text;

-- Partial: rows created before this column existed (and any future path
-- that legitimately has no token) must not all collide on null.
create unique index if not exists campaigns_project_client_token_uniq
  on campaigns (project_id, client_token)
  where client_token is not null;

-- dispatch_scheduled_campaigns runs every 30 seconds and filters on exactly
-- these two columns. Without this it is a sequential scan of the whole
-- campaigns table, twice a minute, forever.
create index if not exists campaigns_status_scheduled_at_idx
  on campaigns (status, scheduled_at);

-- The recovery sweep for campaigns abandoned mid-send (Render's free tier
-- sleeps the process, which used to leave them in "sending" forever) reads
-- status + created_at.
create index if not exists campaigns_status_created_at_idx
  on campaigns (status, created_at);
