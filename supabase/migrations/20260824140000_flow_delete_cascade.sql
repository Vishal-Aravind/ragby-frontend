-- ============================================================
-- Fix flow deletion silently failing when a WhatsApp session
-- still references it
-- ============================================================
-- Surfaced live: deleting a flow returned {"status":"deleted"} but the
-- row never actually disappeared. Root cause was in the API route (see
-- src/app/api/flows/[flowId]/route.js), which never checked its delete
-- call's result — this always existed, it just went unnoticed while RLS
-- was off, since delete previously either genuinely worked or, in this
-- exact case, was ALREADY silently rejected by Postgres's foreign key
-- constraint (whatsapp_sessions.flow_id -> flows.id, no cleanup rule) and
-- nobody could tell.
--
-- whatsapp_sessions is transient bot conversation state (tracks where a
-- customer is mid-flow) — once the flow itself is deleted, a session
-- still pointing at it is meaningless and should be cleaned up
-- automatically, not block deleting the flow.
--
-- Safe to re-run.
-- ============================================================

alter table whatsapp_sessions drop constraint if exists whatsapp_sessions_flow_id_fkey;
alter table whatsapp_sessions
  add constraint whatsapp_sessions_flow_id_fkey
  foreign key (flow_id) references flows(id) on delete cascade;
