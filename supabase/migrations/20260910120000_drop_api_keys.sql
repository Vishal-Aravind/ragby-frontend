-- ============================================================
-- Remove the public API surface
-- ============================================================
-- The API Keys tab and the endpoints it documented are gone:
--
--   POST /public/send            (free-form WhatsApp send)
--   POST /api/send-template      (template send)
--   POST /api/send-template/bulk (up to 100 template sends)
--   GET  /api/templates          (list approved templates)
--
-- Rationale: four internet-facing endpoints that spend the merchant's Meta
-- budget, authenticated by a single long-lived credential, with no customer
-- ever having used them — both issued keys had a null last_used_at, and
-- both existed only because merely OPENING the tab used to mint one.
-- Deleting the surface removes more risk than hardening it did.
--
-- The code is removed in the same commit; it remains in git history if the
-- feature is ever wanted again.
--
-- Safe to re-run.
-- ============================================================

-- api_keys held only key hashes and usage timestamps. Dropping the table
-- also drops its RLS policies (20260824120000) and the key_hash unique
-- index (20260816120000) — no separate cleanup needed.
drop table if exists api_keys;

-- Written only by send_template_api.py and never read by anything: no
-- endpoint, no dashboard view, no report. Orphaned by the same removal.
drop table if exists template_notifications;
