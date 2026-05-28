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
    response,
  };
}

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

  for (const node of nodes) {
    const newId = crypto.randomUUID();
    idMap[node.id] = newId;

    await supabase.from("flow_nodes").insert({
      id: newId,
      flow_id: flowId,
      type: node.type,
      content: node.content || {},
      is_start: node.is_start || false,
    });
  }

  // Insert edges with remapped IDs
  let edgesInserted = 0;
  for (const edge of edges) {
    const fromId = idMap[edge.from_node_id] || edge.from_node_id;
    const toId   = idMap[edge.to_node_id]   || edge.to_node_id;
    if (!fromId || !toId) continue;

    await supabase.from("flow_edges").insert({
      flow_id: flowId,
      from_node_id: fromId,
      trigger: edge.trigger,
      to_node_id: toId,
    });
    edgesInserted++;
  }

  return NextResponse.json({ status: "synced", nodes: nodes.length, edges: edgesInserted, idMap });
}