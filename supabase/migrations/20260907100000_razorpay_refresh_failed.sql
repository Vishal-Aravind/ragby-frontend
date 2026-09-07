-- ============================================================
-- Track a dead Razorpay OAuth connection
-- ============================================================
-- The Razorpay refresh token rotates and is single-use. When a refresh
-- genuinely fails (merchant revoked access, or a rotation was lost), the
-- stored row was left untouched — so every later refresh reused a token
-- Razorpay had already burned, the merchant could never take payments
-- again, and /razorpay/status still cheerfully reported connected: true
-- because it only checked that a row existed.
--
-- Safe to re-run.
-- ============================================================

alter table razorpay_connections
  add column if not exists refresh_failed_at timestamptz;
