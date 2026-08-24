-- ============================================================
-- Fix "infinite recursion detected in policy for relation
-- project_members" — surfaced live when the Flows tab broke
-- right after the previous migration.
-- ============================================================
-- Root cause: project_members already had RLS enabled from before this
-- session, with an admin-check policy whose subquery reads from
-- project_members itself — evaluating it requires re-evaluating the same
-- policy, forever. This was already broken; it had just never been
-- exercised, because nothing previously queried project_members through
-- a non-service-role client. The previous migration's flows/catalogs/etc.
-- policies do exactly that (checking membership via project_members),
-- which is what triggered this pre-existing landmine for the first time.
--
-- Fix: SECURITY DEFINER helper functions. A function marked SECURITY
-- DEFINER runs its OWN internal queries with the function owner's
-- privileges, bypassing RLS for those internal queries only (not for the
-- caller's broader session) — this is the standard Postgres/Supabase
-- pattern for a policy that needs to query the same table it protects,
-- or query a table whose own policies would otherwise recurse back.
--
-- Safe to re-run.
-- ============================================================

create or replace function is_project_owner_or_active_member(check_user_id uuid, check_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from projects
    where projects.id = check_project_id
      and projects.user_id = check_user_id
  )
  or exists (
    select 1 from project_members
    where project_members.project_id = check_project_id
      and project_members.user_id = check_user_id
      and project_members.status = 'active'
  );
$$;

create or replace function is_active_project_admin(check_user_id uuid, check_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from project_members
    where project_id = check_project_id
      and user_id = check_user_id
      and role = 'admin'
      and status = 'active'
  );
$$;


-- ------------------------------------------------------------
-- Fix the actual broken policy that caused the recursion.
-- ------------------------------------------------------------
drop policy if exists "project_members_admin_all" on project_members;
create policy "project_members_admin_all"
  on project_members for all
  using (is_active_project_admin(auth.uid(), project_members.project_id))
  with check (is_active_project_admin(auth.uid(), project_members.project_id));


-- ------------------------------------------------------------
-- Re-point every Group B policy at the helper function instead of a raw
-- inline subquery on project_members — same effective rule as before,
-- just routed through the recursion-safe function.
-- ------------------------------------------------------------

drop policy if exists "chats_project_access" on chats;
create policy "chats_project_access"
  on chats for all
  using (is_project_owner_or_active_member(auth.uid(), chats.project_id))
  with check (is_project_owner_or_active_member(auth.uid(), chats.project_id));

drop policy if exists "flows_project_access" on flows;
create policy "flows_project_access"
  on flows for all
  using (is_project_owner_or_active_member(auth.uid(), flows.project_id))
  with check (is_project_owner_or_active_member(auth.uid(), flows.project_id));

drop policy if exists "catalogs_project_access" on catalogs;
create policy "catalogs_project_access"
  on catalogs for all
  using (is_project_owner_or_active_member(auth.uid(), catalogs.project_id))
  with check (is_project_owner_or_active_member(auth.uid(), catalogs.project_id));

drop policy if exists "products_project_access" on products;
create policy "products_project_access"
  on products for all
  using (is_project_owner_or_active_member(auth.uid(), products.project_id))
  with check (is_project_owner_or_active_member(auth.uid(), products.project_id));

drop policy if exists "orders_project_access" on orders;
create policy "orders_project_access"
  on orders for all
  using (is_project_owner_or_active_member(auth.uid(), orders.project_id))
  with check (is_project_owner_or_active_member(auth.uid(), orders.project_id));

drop policy if exists "shop_config_project_access" on shop_config;
create policy "shop_config_project_access"
  on shop_config for all
  using (is_project_owner_or_active_member(auth.uid(), shop_config.project_id))
  with check (is_project_owner_or_active_member(auth.uid(), shop_config.project_id));

drop policy if exists "whatsapp_sessions_project_access" on whatsapp_sessions;
create policy "whatsapp_sessions_project_access"
  on whatsapp_sessions for all
  using (is_project_owner_or_active_member(auth.uid(), whatsapp_sessions.project_id))
  with check (is_project_owner_or_active_member(auth.uid(), whatsapp_sessions.project_id));

drop policy if exists "appointments_project_access" on appointments;
create policy "appointments_project_access"
  on appointments for all
  using (is_project_owner_or_active_member(auth.uid(), appointments.project_id))
  with check (is_project_owner_or_active_member(auth.uid(), appointments.project_id));

drop policy if exists "event_registrations_project_access" on event_registrations;
create policy "event_registrations_project_access"
  on event_registrations for all
  using (is_project_owner_or_active_member(auth.uid(), event_registrations.project_id))
  with check (is_project_owner_or_active_member(auth.uid(), event_registrations.project_id));

-- Nested tables (no direct project_id — only a parent-row FK) — same
-- parent lookup as before, just calling the safe helper instead of the
-- raw project_members subquery once it finds the parent's project_id.

drop policy if exists "chat_messages_project_access" on chat_messages;
create policy "chat_messages_project_access"
  on chat_messages for all
  using (
    exists (
      select 1 from chats
      where chats.id = chat_messages.chat_id
        and is_project_owner_or_active_member(auth.uid(), chats.project_id)
    )
  )
  with check (
    exists (
      select 1 from chats
      where chats.id = chat_messages.chat_id
        and is_project_owner_or_active_member(auth.uid(), chats.project_id)
    )
  );

drop policy if exists "flow_nodes_project_access" on flow_nodes;
create policy "flow_nodes_project_access"
  on flow_nodes for all
  using (
    exists (
      select 1 from flows
      where flows.id = flow_nodes.flow_id
        and is_project_owner_or_active_member(auth.uid(), flows.project_id)
    )
  )
  with check (
    exists (
      select 1 from flows
      where flows.id = flow_nodes.flow_id
        and is_project_owner_or_active_member(auth.uid(), flows.project_id)
    )
  );

drop policy if exists "flow_edges_project_access" on flow_edges;
create policy "flow_edges_project_access"
  on flow_edges for all
  using (
    exists (
      select 1 from flows
      where flows.id = flow_edges.flow_id
        and is_project_owner_or_active_member(auth.uid(), flows.project_id)
    )
  )
  with check (
    exists (
      select 1 from flows
      where flows.id = flow_edges.flow_id
        and is_project_owner_or_active_member(auth.uid(), flows.project_id)
    )
  );
