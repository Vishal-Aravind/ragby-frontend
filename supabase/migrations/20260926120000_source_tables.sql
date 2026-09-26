-- A queryable copy of each spreadsheet source (Google Sheets / Excel), one
-- row per tab. Sheet data used to live only as embedded rows in Qdrant, which
-- can't be filtered, sorted or counted, and local Excel uploads weren't kept
-- anywhere. Written by the backend during every sync; read by the chat's
-- table-query path. hidden_columns = columns the merchant has NOT exposed to
-- the bot (personal-data-looking columns start hidden).

create table if not exists public.source_tables (
  source_id uuid not null references public.data_sources(id) on delete cascade,
  tab text not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  columns jsonb not null,
  rows jsonb not null,
  hidden_columns jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (source_id, tab)
);

create index if not exists source_tables_project_idx on public.source_tables (project_id);

-- No policies: only the backend (service role) reads or writes this table.
alter table public.source_tables enable row level security;
