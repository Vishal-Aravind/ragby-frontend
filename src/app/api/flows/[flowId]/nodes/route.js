// src/app/api/flows/[flowId]/nodes/route.js
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import {
  ALLOWED_NODE_TYPES,
  MAX_NODES_PER_FLOW,
  MAX_NODE_CONTENT_BYTES,
} from "@/lib/flow-validation";

async function gateForFlow(supabase, userId, flowId) {
  const { data: flow } = await supabase
    .from("flows")
    .select("project_id")
    .eq("id", flowId)
    .maybeSingle();

  if (!flow) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return requireProjectTab(userId, flow.project_id, { tab: "flows" });
}

export async function GET(req, { params }) {
  const { flowId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await gateForFlow(supabase, user.id, flowId);
  if (!gate.ok) return gate.response;

  const [nodesRes, edgesRes, flowRes] = await Promise.all([
    supabase.from("flow_nodes").select("*").eq("flow_id", flowId).order("created_at", { ascending: true }),
    supabase.from("flow_edges").select("*").eq("flow_id", flowId),
    supabase.from("flows").select("revision").eq("id", flowId).maybeSingle(),
  ]);

  if (nodesRes.error || edgesRes.error) {
    console.error("flow graph load failed:", nodesRes.error || edgesRes.error);
    return NextResponse.json({ error: "Could not load this flow." }, { status: 500 });
  }

  // revision is the optimistic-concurrency token the editor sends back on
  // save, so two open tabs can't silently overwrite each other.
  return NextResponse.json({
    nodes: nodesRes.data || [],
    edges: edgesRes.data || [],
    revision: flowRes.data?.revision ?? null,
  });
}

export async function POST(req, { params }) {
  const { flowId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await gateForFlow(supabase, user.id, flowId);
  if (!gate.ok) return gate.response;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!ALLOWED_NODE_TYPES.has(body.type)) {
    return NextResponse.json({ error: "Unknown node type." }, { status: 400 });
  }
  const content = body.content ?? {};
  if (content === null || typeof content !== "object" || Array.isArray(content)) {
    return NextResponse.json({ error: "Node content must be an object." }, { status: 400 });
  }
  if (JSON.stringify(content).length > MAX_NODE_CONTENT_BYTES) {
    return NextResponse.json({ error: "That node is too large." }, { status: 400 });
  }

  const { count } = await supabase
    .from("flow_nodes")
    .select("id", { count: "exact", head: true })
    .eq("flow_id", flowId);

  if ((count || 0) >= MAX_NODES_PER_FLOW) {
    return NextResponse.json(
      { error: `A flow can have at most ${MAX_NODES_PER_FLOW} nodes.` },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("flow_nodes")
    .insert({
      flow_id: flowId,
      type: body.type,
      content,
      is_start: body.is_start === true,
    })
    .select()
    .single();

  if (error) {
    console.error("node create failed:", error);
    return NextResponse.json({ error: "Could not add the node." }, { status: 500 });
  }
  return NextResponse.json(data);
}
