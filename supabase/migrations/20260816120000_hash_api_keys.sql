-- ============================================================
-- Hash Zavo's own customer-facing API keys at rest (security audit fix)
-- ============================================================
-- api_keys.key was previously stored and re-served in plaintext on every
-- GET — this is Zavo's OWN first-party credential (not a third-party
-- integration token, which this codebase already stores in plaintext by a
-- separate, deliberate, already-accepted convention). Standard practice
-- for this kind of customer-facing key (GitHub PATs, Stripe secret keys,
-- etc.) is hash-at-rest + show-once: the customer sees the raw key only
-- at creation/regeneration time, never again after.
--
-- This migration hashes every EXISTING plaintext key in place (SHA-256,
-- matching backend/api_keys.py's hashing) so already-issued keys keep
-- authenticating successfully with zero customer action needed — only the
-- "view it again in the dashboard" behavior changes going forward.
--
-- Safe to re-run.
-- ============================================================

create extension if not exists pgcrypto;

alter table api_keys add column if not exists key_hash text;

update api_keys
set key_hash = encode(digest(key, 'sha256'), 'hex')
where key_hash is null and key is not null;

create unique index if not exists api_keys_key_hash_idx on api_keys (key_hash);

-- FIX: `key` had a not-null constraint in the live schema that this
-- migration originally missed — must drop it before nulling the column
-- out below, or the update fails with a not-null violation.
alter table api_keys alter column key drop not null;

-- Hashing is pointless if the plaintext just sits in a different column —
-- clear it now that every row's hash is populated.
update api_keys set key = null where key_hash is not null;
