// src/app/api/flows/nodes/[nodeId]/route.js
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { ALLOWED_NODE_TYPES, MAX_NODE_CONTENT_BYTES } from "@/lib/flow-validation";

async function gateForNode(supabase, userId, nodeId) {
  const { data: node } = await supabase
    .from("flow_nodes")
    .select("flow_id")
    .eq("id", nodeId)
    .maybeSingle();
  if (!node) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const { data: flow } = await supabase
    .from("flows")
    .select("project_id")
    .eq("id", node.flow_id)
    .maybeSingle();
  if (!flow) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return requireProjectTab(userId, flow.project_id, { tab: "flows" });
}

export async function PUT(req, { params }) {
  const { nodeId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await gateForNode(supabase, user.id, nodeId);
  if (!gate.ok) return gate.response;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const update = {};
  if ("type" in body) {
    if (!ALLOWED_NODE_TYPES.has(body.type)) {
      return NextResponse.json({ error: "Unknown node type." }, { status: 400 });
    }
    update.type = body.type;
  }
  if ("content" in body) {
    const content = body.content ?? {};
    if (content === null || typeof content !== "object" || Array.isArray(content)) {
      return NextResponse.json({ error: "Node content must be an object." }, { status: 400 });
    }
    if (JSON.stringify(content).length > MAX_NODE_CONTENT_BYTES) {
      return NextResponse.json({ error: "That node is too large." }, { status: 400 });
    }
    update.content = content;
  }
  if ("is_start" in body) update.is_start = body.is_start === true;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("flow_nodes")
    .update(update)
    .eq("id", nodeId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("node update failed:", error);
    return NextResponse.json({ error: "Could not save the node." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Update affected no rows — check permissions" },
      { status: 403 }
    );
  }
  return NextResponse.json(data);
}

export async function DELETE(req, { params }) {
  const { nodeId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await gateForNode(supabase, user.id, nodeId);
  if (!gate.ok) return gate.response;

  // A session parked on this node would block the delete on the FK, and the
  // route used to ignore the result and report success either way.
  await supabase
    .from("whatsapp_sessions")
    .update({ current_node_id: null })
    .eq("current_node_id", nodeId);

  const { data: deleted, error } = await supabase
    .from("flow_nodes")
    .delete()
    .eq("id", nodeId)
    .select();

  if (error) {
    console.error("node delete failed:", error);
    return NextResponse.json({ error: "Could not delete the node." }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Delete affected no rows — check permissions" }, { status: 403 });
  }
  return NextResponse.json({ status: "deleted" });
}
