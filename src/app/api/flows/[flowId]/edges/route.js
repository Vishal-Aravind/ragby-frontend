// src/app/api/flows/[flowId]/edges/route.js
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { MAX_EDGES_PER_FLOW, MAX_TRIGGER_LEN } from "@/lib/flow-validation";

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

  const trigger = body.trigger;
  if (typeof trigger !== "string" || !trigger || trigger.length > MAX_TRIGGER_LEN) {
    return NextResponse.json({ error: "Invalid connection trigger." }, { status: 400 });
  }

  // CROSS-TENANT FIX: this route only ever checked that flow_id belonged to
  // the caller — never that the two endpoints did. backend/flows.py's
  // get_node looked a node up by id alone, so an edge pointing at ANOTHER
  // project's node id would happily fetch that node and send its content to
  // the caller's own WhatsApp number. Both endpoints must be nodes in this
  // exact flow.
  const endpoints = [body.from_node_id, body.to_node_id];
  if (endpoints.some((id) => typeof id !== "string" || !id)) {
    return NextResponse.json({ error: "Both ends of a connection are required." }, { status: 400 });
  }

  const { data: owned, error: ownedError } = await supabase
    .from("flow_nodes")
    .select("id")
    .eq("flow_id", flowId)
    .in("id", endpoints);

  if (ownedError) {
    console.error("edge endpoint check failed:", ownedError);
    return NextResponse.json({ error: "Could not add the connection." }, { status: 500 });
  }

  const ownedIds = new Set((owned || []).map((n) => n.id));
  if (!endpoints.every((id) => ownedIds.has(id))) {
    return NextResponse.json(
      { error: "A connection must join two nodes in the same flow." },
      { status: 400 }
    );
  }

  const { count } = await supabase
    .from("flow_edges")
    .select("id", { count: "exact", head: true })
    .eq("flow_id", flowId);

  if ((count || 0) >= MAX_EDGES_PER_FLOW) {
    return NextResponse.json(
      { error: `A flow can have at most ${MAX_EDGES_PER_FLOW} connections.` },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("flow_edges")
    .insert({
      flow_id: flowId,
      from_node_id: body.from_node_id,
      trigger,
      to_node_id: body.to_node_id,
    })
    .select()
    .single();

  if (error) {
    console.error("edge create failed:", error);
    return NextResponse.json({ error: "Could not add the connection." }, { status: 500 });
  }
  return NextResponse.json(data);
}
