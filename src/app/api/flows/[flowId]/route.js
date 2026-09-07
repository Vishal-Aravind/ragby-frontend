// src/app/api/flows/[flowId]/route.js
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { normalizeTriggerKeywords, validateFlowName } from "@/lib/flow-validation";

async function gateForFlow(supabase, userId, flowId, opts) {
  const { data: flow } = await supabase
    .from("flows")
    .select("project_id")
    .eq("id", flowId)
    .maybeSingle();

  if (!flow) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const gate = await requireProjectTab(userId, flow.project_id, opts);
  return gate.ok ? { ...gate, projectId: flow.project_id } : gate;
}

export async function PUT(req, { params }) {
  const { flowId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Activating a flow swaps out the live WhatsApp bot for every customer,
  // so it needs admin, not merely "some role on the project".
  const needsAdmin = "is_active" in body;
  const gate = await gateForFlow(supabase, user.id, flowId, {
    tab: "flows",
    minRole: needsAdmin ? "admin" : undefined,
  });
  if (!gate.ok) return gate.response;

  const update = {};
  if ("name" in body) {
    const nameError = validateFlowName(body.name);
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });
    update.name = body.name.trim();
  }
  if ("free_questions" in body) update.free_questions = body.free_questions === true;
  if ("trigger_keywords" in body) {
    const keywords = normalizeTriggerKeywords(body.trigger_keywords);
    if (keywords.error) return NextResponse.json({ error: keywords.error }, { status: 400 });
    update.trigger_keywords = keywords.value;
  }

  // Activation goes through a database function so "deactivate the others"
  // and "activate this one" happen in a single transaction. Done as two
  // separate statements (as it was), two concurrent activations could leave
  // the project with two active flows or none, and get_active_flow in
  // backend/flows.py takes limit(1) — so the live bot became arbitrary.
  if ("is_active" in body) {
    const { error: activeError } = await supabase.rpc("set_flow_active", {
      p_flow_id: flowId,
      p_active: body.is_active === true,
    });
    if (activeError) {
      console.error("flow activation failed:", activeError);
      return NextResponse.json(
        { error: "Could not change the flow's active state." },
        { status: 500 }
      );
    }
  }

  if (Object.keys(update).length === 0) {
    const { data: current } = await supabase
      .from("flows")
      .select("id, name, is_active, trigger_keywords, free_questions, revision, created_at")
      .eq("id", flowId)
      .maybeSingle();
    return NextResponse.json(current || { status: "ok" });
  }

  const { data, error } = await supabase
    .from("flows")
    .update(update)
    .eq("id", flowId)
    .select("id, name, is_active, trigger_keywords, free_questions, revision, created_at")
    .maybeSingle();

  if (error) {
    console.error("flow update failed:", error);
    return NextResponse.json({ error: "Could not save the flow." }, { status: 500 });
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
  const { flowId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Deleting the live bot script is destructive and unrecoverable.
  const gate = await gateForFlow(supabase, user.id, flowId, {
    tab: "flows",
    minRole: "admin",
  });
  if (!gate.ok) return gate.response;

  // FIX: was never checking the delete's result — with RLS off (as this
  // table always was until now) that was harmless, but it meant a
  // filtered/failed delete would still report fake success. .select()
  // after delete() returns exactly the rows that were actually removed,
  // so this can now tell the difference.
  const { data: deletedRows, error } = await supabase
    .from("flows")
    .delete()
    .eq("id", flowId)
    .select();

  if (error) {
    console.error("flow delete failed:", error);
    return NextResponse.json({ error: "Could not delete the flow." }, { status: 500 });
  }
  if (!deletedRows || deletedRows.length === 0) {
    return NextResponse.json({ error: "Delete affected no rows — check permissions" }, { status: 403 });
  }
  return NextResponse.json({ status: "deleted" });
}
