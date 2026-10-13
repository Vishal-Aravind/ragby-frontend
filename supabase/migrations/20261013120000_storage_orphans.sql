-- Uploaded media (flow-media bucket) that nothing uses any more, and since
-- when. backend/storage_cleanup.py notes a file here the first day it finds
-- it unused, un-notes it if it's used again, and deletes it from storage once
-- it has stayed unused for 7 days. Only the backend (service role) uses it.
create table if not exists public.storage_orphans (
  path            text primary key,
  first_unused_at timestamptz not null default now()
);

alter table public.storage_orphans enable row level security;
