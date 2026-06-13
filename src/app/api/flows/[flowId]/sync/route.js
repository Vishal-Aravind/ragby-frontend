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

  // Step 1: Get all node IDs for this flow
  const { data: existingNodes } = await supabase
    .from("flow_nodes")
    .select("id")
    .eq("flow_id", flowId);

  const existingNodeIds = (existingNodes || []).map(n => n.id);

  // Step 2: Clear sessions that reference these nodes (fixes FK constraint)
  if (existingNodeIds.length > 0) {
    await supabase
      .from("whatsapp_sessions")
      .update({ current_node_id: null })
      .in("current_node_id", existingNodeIds);
  }

  // Step 3: Delete edges then nodes
  await supabase.from("flow_edges").delete().eq("flow_id", flowId);
  await supabase.from("flow_nodes").delete().eq("flow_id", flowId);

  if (nodes.length === 0) {
    return NextResponse.json({ status: "synced", nodes: 0, edges: 0, idMap: {} });
  }

  // Step 4: Build ID map and bulk insert nodes
  const idMap = {};
  const nodeRows = nodes.map((node) => {
    const newId = crypto.randomUUID();
    idMap[node.id] = newId;
    return {
      id: newId,
      flow_id: flowId,
      type: node.data?.type || node.type,
      content: node.data?.content || node.content || {},
      is_start: node.data?.isStart || node.is_start || false,
      position: node.position || { x: 0, y: 0 },
    };
  });

  const { error: nodesError } = await supabase.from("flow_nodes").insert(nodeRows);
  if (nodesError) {
    console.error("nodes insert error:", nodesError);
    return NextResponse.json({ error: nodesError.message }, { status: 500 });
  }

  // Step 5: Bulk insert edges
  const edgeRows = [];
  for (const edge of edges) {
    const fromId = idMap[edge.source || edge.from_node_id] || edge.source || edge.from_node_id;
    const toNodeId = idMap[edge.target || edge.to_node_id] || edge.target || edge.to_node_id;
    if (!fromId || !toNodeId) continue;
    edgeRows.push({
      flow_id: flowId,
      from_node_id: fromId,
      trigger: edge.sourceHandle || edge.trigger || "next",
      to_node_id: toNodeId,
    });
  }

  if (edgeRows.length > 0) {
    const { error: edgesError } = await supabase.from("flow_edges").insert(edgeRows);
    if (edgesError) {
      console.error("edges insert error:", edgesError);
      return NextResponse.json({ error: edgesError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    status: "synced",
    nodes: nodes.length,
    edges: edgeRows.length,
    idMap,
  });
}