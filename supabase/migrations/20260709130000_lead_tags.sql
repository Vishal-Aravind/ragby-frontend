-- ============================================================
-- Lead tagging — used by Leads tab and Campaigns' "filter by tag"
-- ============================================================
-- Campaigns' backend already assumed a `tags` column existed on `leads`
-- (recipient_filter="tag" does .contains("tags", [tag_filter])), but
-- nothing ever created it or exposed a way to set it. This adds it.
--
-- Safe to re-run.
-- ============================================================

alter table leads add column if not exists tags text[] not null default '{}';
