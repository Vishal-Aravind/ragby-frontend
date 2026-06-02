// src/app/api/flows/[flowId]/sync/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getSupabase(req) {
  const response = NextResponse.next();
  return {
    supabase: createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name) => req.cookies.get(name)?.value,
          set: (name, value, options) => response.cookies.set({ name, value, ...options }),
          remove: (name, options) => response.cookies.set({ name, value: "", ...options }),
        },
      }
    ),
  };
}

const toId = (label) =>
  (label || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `id_${Date.now()}`;

export async function POST(req, { params }) {
  const { flowId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const nodes = body.nodes || [];
  const edges = body.edges || [];

  // Delete all existing nodes (cascade deletes edges)
  await supabase.from("flow_nodes").delete().eq("flow_id", flowId);

  if (nodes.length === 0) {
    return NextResponse.json({ status: "synced", nodes: 0, edges: 0 });
  }

  // Build ID map: local ID → new DB ID
  const idMap = {};

  // Build button ID map per node: sourceHandle → correct button ID from current labels
  // This fixes the issue where button labels are renamed but edge triggers still have old IDs
  const buttonIdMap = {}; // { nodeLocalId: { oldTriggerId: newTriggerId } }

  for (const node of nodes) {
    const newId = crypto.randomUUID();
    idMap[node.id] = newId;

    // Build button label → ID mapping for buttons/list nodes
    if (node.data?.type === "message_buttons" && node.data?.content?.buttons) {
      buttonIdMap[node.id] = {};
      node.data.content.buttons.forEach(btn => {
        if (btn.label) {
          const currentId = toId(btn.label);
          buttonIdMap[node.id][currentId] = currentId;
        }
      });
    }
    if (node.data?.type === "message_list" && node.data?.content?.sections) {
      buttonIdMap[node.id] = {};
      node.data.content.sections.forEach(section => {
        (section.rows || []).forEach(row => {
          if (row.label) {
            const currentId = toId(row.label);
            buttonIdMap[node.id][currentId] = currentId;
          }
        });
      });
    }

    await supabase.from("flow_nodes").insert({
      id: newId,
      flow_id: flowId,
      type: node.data?.type || node.type,
      content: node.data?.content || node.content || {},
      is_start: node.data?.isStart || node.is_start || false,
      position: node.position || { x: 0, y: 0 },
    });
  }

  // Insert edges with remapped IDs
  let edgesInserted = 0;
  for (const edge of edges) {
    const fromId = idMap[edge.source || edge.from_node_id] || edge.source || edge.from_node_id;
    const toId_  = idMap[edge.target || edge.to_node_id]   || edge.target || edge.to_node_id;
    if (!fromId || !toId_) continue;

    // Get the trigger — use sourceHandle which is the current button ID
    let trigger = edge.sourceHandle || edge.trigger || "next";

    await supabase.from("flow_edges").insert({
      flow_id: flowId,
      from_node_id: fromId,
      trigger,
      to_node_id: toId_,
    });
    edgesInserted++;
  }

  return NextResponse.json({ status: "synced", nodes: nodes.length, edges: edgesInserted, idMap });
}