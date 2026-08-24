-- ============================================================
-- Database-level lockdown — Row Level Security across the schema
-- ============================================================
-- Confirmed live: an unauthenticated curl request against /rest/v1/profiles
-- using only the public anon key (no login at all) returned every user's
-- email and plan. 34 of ~39 tables had RLS disabled. Every backend
-- (require_project_role) and frontend (getProjectRole) check built this
-- session is real and still works for traffic through the app — none of
-- it matters to someone who talks to Supabase directly, which anyone can
-- do with the anon key already shipped in the site's own JS bundle.
--
-- Two research passes (see plan file) confirmed exactly which tables are
-- queried via a non-service-role client (getSupabase(req), session-cookie
-- bound) vs. only ever via the service-role client (supabaseAdmin in
-- Next.js, or backend/clients.py's supabase in FastAPI, which always
-- bypasses RLS regardless of what's enabled here). That split drives the
-- two groups below.
--
-- Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- GROUP A — enable RLS, zero new policies.
-- Confirmed: no code anywhere queries these via a non-service-role
-- client. Enabling RLS with no policies means total default-deny for
-- anon/authenticated, while supabaseAdmin / backend's service-role
-- client continue working completely unaffected (service role always
-- bypasses RLS). This alone fully closes the exposure for these tables.
-- ------------------------------------------------------------

alter table admin_audit_log enable row level security;
alter table admin_impersonation_sessions enable row level security;
alter table api_keys enable row level security;
alter table appointment_services enable row level security;
alter table appointment_settings enable row level security;
alter table campaigns enable row level security;
alter table cart_sessions enable row level security;
alter table data_sources enable row level security;
alter table events enable row level security;
alter table form_submissions enable row level security;
alter table job_runs enable row level security;
alter table lead_capture_config enable row level security;
alter table leads enable row level security;
alter table profiles enable row level security;
alter table shopify_cart_sessions enable row level security;
alter table shopify_integrations enable row level security;
alter table slack_integrations enable row level security;
alter table staff_roles enable row level security;
alter table telegram_integrations enable row level security;
alter table template_notifications enable row level security;
alter table usage enable row level security;
alter table whatsapp_integrations enable row level security;

-- projects gets the same zero-policy treatment, but first drop the old
-- dormant "projects_member_select" policy — RLS was disabled on this
-- table, so this policy has been inactive, but enabling RLS would
-- silently reactivate it. Confirmed nothing queries `projects` via a
-- non-service client, so nothing needs it.
drop policy if exists "projects_member_select" on projects;
alter table projects enable row level security;


-- ------------------------------------------------------------
-- GROUP B — enable RLS with a real project-scoped policy.
-- Confirmed: genuinely queried via the session-bound anon client
-- (getSupabase(req)) in real, working dashboard routes. A zero-policy
-- lockdown here would break the app. Reuses the exact template already
-- proven in this database (content_gap_resolutions, chat_notes,
-- project_members): owner OR an active project_members row.
-- ------------------------------------------------------------

alter table chats enable row level security;
drop policy if exists "chats_project_access" on chats;
create policy "chats_project_access"
  on chats for all
  using (
    exists (
      select 1 from projects
      where projects.id = chats.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from projects
      where projects.id = chats.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );

alter table flows enable row level security;
drop policy if exists "flows_project_access" on flows;
create policy "flows_project_access"
  on flows for all
  using (
    exists (
      select 1 from projects
      where projects.id = flows.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from projects
      where projects.id = flows.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );

alter table catalogs enable row level security;
drop policy if exists "catalogs_project_access" on catalogs;
create policy "catalogs_project_access"
  on catalogs for all
  using (
    exists (
      select 1 from projects
      where projects.id = catalogs.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from projects
      where projects.id = catalogs.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );

alter table products enable row level security;
drop policy if exists "products_project_access" on products;
create policy "products_project_access"
  on products for all
  using (
    exists (
      select 1 from projects
      where projects.id = products.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from projects
      where projects.id = products.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );

alter table orders enable row level security;
drop policy if exists "Public insert orders" on orders;
drop policy if exists "orders_project_access" on orders;
create policy "orders_project_access"
  on orders for all
  using (
    exists (
      select 1 from projects
      where projects.id = orders.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from projects
      where projects.id = orders.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );

alter table shop_config enable row level security;
drop policy if exists "Public read shop_config" on shop_config;
drop policy if exists "shop_config_project_access" on shop_config;
create policy "shop_config_project_access"
  on shop_config for all
  using (
    exists (
      select 1 from projects
      where projects.id = shop_config.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from projects
      where projects.id = shop_config.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );

alter table whatsapp_sessions enable row level security;
drop policy if exists "Public update sessions" on whatsapp_sessions;
drop policy if exists "whatsapp_sessions_project_access" on whatsapp_sessions;
create policy "whatsapp_sessions_project_access"
  on whatsapp_sessions for all
  using (
    exists (
      select 1 from projects
      where projects.id = whatsapp_sessions.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from projects
      where projects.id = whatsapp_sessions.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );

alter table appointments enable row level security;
drop policy if exists "appointments_project_access" on appointments;
create policy "appointments_project_access"
  on appointments for all
  using (
    exists (
      select 1 from projects
      where projects.id = appointments.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from projects
      where projects.id = appointments.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );

alter table event_registrations enable row level security;
drop policy if exists "event_registrations_project_access" on event_registrations;
create policy "event_registrations_project_access"
  on event_registrations for all
  using (
    exists (
      select 1 from projects
      where projects.id = event_registrations.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from projects
      where projects.id = event_registrations.project_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );

-- chat_messages, flow_nodes, flow_edges — no direct project_id column,
-- only a parent-row FK. Same chat_notes-style nested exists, joining
-- through the parent first.

alter table chat_messages enable row level security;
drop policy if exists "chat_messages_project_access" on chat_messages;
create policy "chat_messages_project_access"
  on chat_messages for all
  using (
    exists (
      select 1 from chats
      join projects on projects.id = chats.project_id
      where chats.id = chat_messages.chat_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from chats
      join projects on projects.id = chats.project_id
      where chats.id = chat_messages.chat_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );

alter table flow_nodes enable row level security;
drop policy if exists "flow_nodes_project_access" on flow_nodes;
create policy "flow_nodes_project_access"
  on flow_nodes for all
  using (
    exists (
      select 1 from flows
      join projects on projects.id = flows.project_id
      where flows.id = flow_nodes.flow_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from flows
      join projects on projects.id = flows.project_id
      where flows.id = flow_nodes.flow_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );

alter table flow_edges enable row level security;
drop policy if exists "flow_edges_project_access" on flow_edges;
create policy "flow_edges_project_access"
  on flow_edges for all
  using (
    exists (
      select 1 from flows
      join projects on projects.id = flows.project_id
      where flows.id = flow_edges.flow_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from flows
      join projects on projects.id = flows.project_id
      where flows.id = flow_edges.flow_id
        and (
          projects.user_id = auth.uid()
          or exists (
            select 1 from project_members pm
            where pm.project_id = projects.id
              and pm.user_id = auth.uid()
              and pm.status = 'active'
          )
        )
    )
  );


-- ------------------------------------------------------------
-- One project per account — enforced at the DB level, not just in
-- src/app/api/projects/route.js's application code. Confirmed that's
-- the only place that ever inserts a project row, and the account that
-- had duplicates has already been cleaned up to one.
-- ------------------------------------------------------------

alter table projects add constraint projects_user_id_unique unique (user_id);
