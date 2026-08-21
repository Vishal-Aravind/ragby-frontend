-- ============================================================
-- Internal admin panel — staff roles, audit log, impersonation
-- sessions, scheduler job tracking, tenant suspend flag
-- ============================================================
-- Replaces the old admin gate (a single hardcoded email compared in 3
-- frontend files, checked via the unsafe getSession()) with a real table.
-- No RLS on any of these — consistent with this codebase's established
-- pattern (service-role client + an explicit application-level check per
-- request, e.g. require_project_role/getProjectRole), not RLS-as-a-
-- safety-net. The actual security boundary is requireStaff() in
-- src/lib/admin-auth.js, called by every /api/admin/** route.
--
-- Safe to re-run.
-- ============================================================

create table if not exists staff_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

-- Self-seeding: whoever is running this migration gets staff access.
-- Adding a second staff member later is just another row in this table.
insert into staff_roles (user_id, role)
select id, 'owner' from auth.users where email = 'khavinprakash03@gmail.com'
on conflict (user_id) do nothing;

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users(id),
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx on admin_audit_log (target_type, target_id);

-- Backs the read-only "view as tenant" feature. No real Supabase session is
-- ever forged — a valid, unexpired row here only ever satisfies a GET-only
-- project-access check (enforced server-side, not just hidden in the UI).
create table if not exists admin_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users(id),
  target_project_id uuid not null references projects(id) on delete cascade,
  reason text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_impersonation_sessions_expiry_idx
  on admin_impersonation_sessions (expires_at);

-- Last-run/success tracking for the 4 APScheduler jobs in backend/main.py —
-- today those only print() to stdout and forward failures to Sentry, with
-- no queryable history at all.
create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists job_runs_job_name_idx on job_runs (job_name, created_at desc);

-- MVP kill switch — checked in backend/chat.py's run_chat(), which every
-- channel (public widget, WhatsApp, Telegram, Slack, in-app test chat)
-- funnels through before generating a bot reply.
alter table projects add column if not exists suspended boolean not null default false;
