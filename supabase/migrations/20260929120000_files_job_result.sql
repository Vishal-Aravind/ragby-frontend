-- Indexing now runs as a background job (a separate worker service), so the
-- upload request returns before the file is processed. The outcome that
-- used to come back in the HTTP response is recorded on the row instead:
--   error  — why processing failed, shown to the merchant
--   result — {truncated, indexed_count, total_count} on success
alter table public.files add column if not exists error text;
alter table public.files add column if not exists result jsonb;
