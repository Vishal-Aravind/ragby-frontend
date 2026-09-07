-- ============================================================
-- Flows: atomic saves, activation without a race, unique sessions
-- ============================================================
-- Three separate problems, one migration, because the sync function needs
-- the revision column and the activation function needs the same locking
-- discipline.
--
-- 1. Saving a flow was destructive. src/app/api/flows/[flowId]/sync/route.js
--    deleted every edge and every node for the flow, then re-inserted them
--    as separate statements. It runs on a 30-second autosave timer, so any
--    failure in between — a cold start, a dropped connection, a bad row —
--    left the merchant with an EMPTY flow and a 500. sync_flow_graph does
--    the whole rewrite in one transaction instead.
--
-- 2. Two browser tabs silently overwrote each other, because nothing
--    detected that the flow had changed since the editor loaded it. The new
--    `revision` column is the optimistic-concurrency token.
--
-- 3. whatsapp_sessions has no unique constraint, but backend/flows.py's
--    upsert_session does .upsert(on_conflict="project_id,phone_number") —
--    which is only an upsert if that constraint EXISTS. Without it the
--    upsert appends, and get_session takes res.data[0], so a customer's
--    position in the flow became arbitrary between messages. Same defect
--    class as the leads table in 20260907140000.
--
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Revision token
-- ------------------------------------------------------------
alter table flows
  add column if not exists revision bigint not null default 1;

-- ------------------------------------------------------------
-- 2. Activation, without the two-statement race
-- ------------------------------------------------------------
-- The route did "deactivate every other flow" and "activate this one" as
-- two separate calls. Two concurrent activations could interleave and leave
-- the project with two active flows or none — and get_active_flow in
-- backend/flows.py takes limit(1), so which flow was live became arbitrary.
--
-- security invoker (the default) is deliberate: the caller is the browser's
-- anon-key session, so the existing RLS policies on `flows` still decide
-- whether this user may touch this project's rows at all.
create or replace function set_flow_active(p_flow_id uuid, p_active boolean)
returns void
language plpgsql
as $$
declare
  v_project_id uuid;
begin
  -- Lock first. Anything else racing this flow queues behind us.
  select project_id into v_project_id
  from flows where id = p_flow_id
  for update;

  if v_project_id is null then
    raise exception 'flow_not_found';
  end if;

  if p_active then
    update flows set is_active = false
    where project_id = v_project_id and id <> p_flow_id and is_active;
  end if;

  update flows set is_active = p_active where id = p_flow_id;
end;
$$;

-- ------------------------------------------------------------
-- 3. The atomic graph rewrite
-- ------------------------------------------------------------
-- p_nodes:  [{id, type, content, is_start, position}, ...]  (ids are fresh
--           UUIDs minted by the route — never an id the browser chose)
-- p_edges:  [{from_node_id, trigger, to_node_id}, ...]      (already
--           resolved against those new ids by the route)
-- p_revision: the revision the editor loaded, or null to skip the check.
create or replace function sync_flow_graph(
  p_flow_id  uuid,
  p_nodes    jsonb,
  p_edges    jsonb,
  p_revision bigint default null
)
returns jsonb
language plpgsql
as $$
declare
  v_current  bigint;
  v_next     bigint;
  v_node_ids uuid[];
begin
  -- Lock the flow row for the whole rewrite, so a second save waits rather
  -- than interleaving its deletes with our inserts.
  select revision into v_current
  from flows where id = p_flow_id
  for update;

  if v_current is null then
    raise exception 'flow_not_found';
  end if;

  -- Optimistic concurrency. The editor sends the revision it loaded; if the
  -- flow moved on since then, someone else saved and we must not clobber
  -- them. The route turns this into a 409.
  if p_revision is not null and p_revision <> v_current then
    raise exception 'flow_revision_conflict';
  end if;

  -- Sessions parked on a node we're about to delete would block the delete
  -- on the FK. Scoped to THIS flow's nodes only.
  update whatsapp_sessions
  set current_node_id = null
  where current_node_id in (select id from flow_nodes where flow_id = p_flow_id);

  delete from flow_edges where flow_id = p_flow_id;
  delete from flow_nodes where flow_id = p_flow_id;

  if p_nodes is not null and jsonb_array_length(p_nodes) > 0 then
    insert into flow_nodes (id, flow_id, type, content, is_start, position)
    select
      (n->>'id')::uuid,
      p_flow_id,
      n->>'type',
      coalesce(n->'content', '{}'::jsonb),
      coalesce((n->>'is_start')::boolean, false),
      coalesce(n->'position', '{"x":0,"y":0}'::jsonb)
    from jsonb_array_elements(p_nodes) as n;
  end if;

  select coalesce(array_agg(id), '{}') into v_node_ids
  from flow_nodes where flow_id = p_flow_id;

  -- CROSS-TENANT GUARD. Even though the route already resolves every edge
  -- against the nodes it just minted, this is the backstop: an edge may
  -- only join two nodes that now exist in THIS flow. Previously an edge
  -- could carry a raw client-supplied id — including a node id belonging to
  -- another project — and backend/flows.py's get_node would fetch it by id
  -- with no flow filter and send its content to the caller.
  if p_edges is not null and jsonb_array_length(p_edges) > 0 then
    insert into flow_edges (flow_id, from_node_id, trigger, to_node_id)
    select
      p_flow_id,
      (e->>'from_node_id')::uuid,
      coalesce(nullif(e->>'trigger', ''), 'next'),
      (e->>'to_node_id')::uuid
    from jsonb_array_elements(p_edges) as e
    where (e->>'from_node_id')::uuid = any(v_node_ids)
      and (e->>'to_node_id')::uuid   = any(v_node_ids);
  end if;

  v_next := v_current + 1;
  update flows set revision = v_next where id = p_flow_id;

  return jsonb_build_object('revision', v_next);
end;
$$;

-- Both functions are called from the Next.js routes using the browser's
-- own session (anon key + user JWT), so the `authenticated` role needs
-- EXECUTE. They are security INVOKER, so this grants the ability to call
-- them, not any escalated access — RLS still decides which rows the caller
-- can touch. Revoked from anon and public: neither should reach these.
revoke all on function set_flow_active(uuid, boolean) from public, anon;
revoke all on function sync_flow_graph(uuid, jsonb, jsonb, bigint) from public, anon;
grant execute on function set_flow_active(uuid, boolean) to authenticated;
grant execute on function sync_flow_graph(uuid, jsonb, jsonb, bigint) to authenticated;

-- ------------------------------------------------------------
-- 4. whatsapp_sessions uniqueness
-- ------------------------------------------------------------
-- Ordered by ctid desc: this table's shape isn't defined in any migration
-- and may have no timestamp column to sort on. For transient conversation
-- state the newest physical row version is the right one to keep, and a
-- wrong guess here costs a customer one restarted conversation, not data.
delete from whatsapp_sessions s
using (
  select ctid, row_number() over (
    partition by project_id, phone_number
    order by ctid desc
  ) as rn
  from whatsapp_sessions
) d
where s.ctid = d.ctid and d.rn > 1;

alter table whatsapp_sessions
  drop constraint if exists whatsapp_sessions_project_phone_key;
alter table whatsapp_sessions
  add constraint whatsapp_sessions_project_phone_key
  unique (project_id, phone_number);

-- ------------------------------------------------------------
-- 5. Supporting index
-- ------------------------------------------------------------
-- sync_flow_graph and the node-delete route both look sessions up by the
-- node they're parked on.
create index if not exists whatsapp_sessions_current_node_idx
  on whatsapp_sessions (current_node_id)
  where current_node_id is not null;
