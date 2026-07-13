-- ============================================================
-- Custom per-agent permissions
-- ============================================================
-- Agents default to Conversations + Leads only. Owner/admin can now grant
-- an individual agent access to specific additional tabs (e.g. Analytics,
-- Campaigns) without promoting them to Admin. Only meaningful when
-- role = 'agent' — admins/owner already have full access, and Team
-- management is deliberately never grantable this way (would let an
-- agent add/remove teammates or escalate their own role).
--
-- Safe to re-run.
-- ============================================================

alter table project_members add column if not exists permissions text[];
