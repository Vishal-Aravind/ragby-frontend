// src/app/api/flows/[flowId]/sync/route.js
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { validateGraph } from "@/lib/flow-validation";

export async function POST(req, { params }) {
  const { flowId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: flow } = await supabase
    .from("flows")
    .select("project_id")
    .eq("id", flowId)
    .maybeSingle();
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const gate = await requireProjectTab(user.id, flow.project_id, { tab: "flows" });
  if (!gate.ok) return gate.response;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const nodes = body.nodes || [];
  const edges = body.edges || [];

  const graphError = validateGraph(nodes, edges);
  if (graphError) return NextResponse.json({ error: graphError }, { status: 400 });

  // Client ids ("local_1738..." for unsaved nodes, real UUIDs for saved
  // ones) are mapped to fresh UUIDs here so the database function never has
  // to trust an id the browser chose. Edges are then resolved against this
  // map ONLY — an edge whose endpoint isn't in it is dropped rather than
  // being passed through raw, which is how an edge could previously come to
  // point at another project's node.
  const idMap = {};
  for (const node of nodes) {
    if (node?.id != null) idMap[String(node.id)] = crypto.randomUUID();
  }

  const nodeRows = nodes.map((node) => ({
    id: idMap[String(node.id)],
    type: node.data?.type || node.type,
    content: node.data?.content ?? node.content ?? {},
    is_start: (node.data?.isStart ?? node.is_start) === true,
    position: node.position || { x: 0, y: 0 },
  }));

  const edgeRows = [];
  let droppedEdges = 0;
  for (const edge of edges) {
    const from = idMap[String(edge.source ?? edge.from_node_id)];
    const to = idMap[String(edge.target ?? edge.to_node_id)];
    if (!from || !to) {
      droppedEdges += 1;
      continue;
    }
    edgeRows.push({
      from_node_id: from,
      trigger: edge.sourceHandle || edge.trigger || "next",
      to_node_id: to,
    });
  }

  // Everything below happens inside ONE transaction in the database.
  //
  // This route used to delete every edge and every node for the flow and
  // then re-insert them as separate statements. It runs on a 30-second
  // autosave timer, so a failure between the delete and the insert — a cold
  // start, a dropped connection, a validation error — left the merchant
  // with an empty flow and a 500. Now a failure changes nothing at all.
  const { data, error } = await supabase.rpc("sync_flow_graph", {
    p_flow_id: flowId,
    p_nodes: nodeRows,
    p_edges: edgeRows,
    p_revision: Number.isInteger(body.revision) ? body.revision : null,
  });

  if (error) {
    // Raised by the function when the flow changed since this editor loaded
    // it — another tab, or another person, saved in the meantime.
    if (error.message?.includes("flow_revision_conflict")) {
      return NextResponse.json(
        { error: "This flow was changed somewhere else. Reload before saving." },
        { status: 409 }
      );
    }
    console.error("flow sync failed:", error);
    return NextResponse.json({ error: "Could not save the flow." }, { status: 500 });
  }

  return NextResponse.json({
    status: "synced",
    nodes: nodeRows.length,
    edges: edgeRows.length,
    droppedEdges,
    revision: data?.revision ?? null,
    idMap,
  });
}
