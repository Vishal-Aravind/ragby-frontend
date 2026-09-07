// src/app/api/flows/edges/[edgeId]/route.js
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";

export async function DELETE(req, { params }) {
  const { edgeId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: edge } = await supabase
    .from("flow_edges")
    .select("flow_id")
    .eq("id", edgeId)
    .maybeSingle();
  if (!edge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: flow } = await supabase
    .from("flows")
    .select("project_id")
    .eq("id", edge.flow_id)
    .maybeSingle();
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const gate = await requireProjectTab(user.id, flow.project_id, { tab: "flows" });
  if (!gate.ok) return gate.response;

  const { data: deleted, error } = await supabase
    .from("flow_edges")
    .delete()
    .eq("id", edgeId)
    .select();

  if (error) {
    console.error("edge delete failed:", error);
    return NextResponse.json({ error: "Could not delete the connection." }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Delete affected no rows — check permissions" }, { status: 403 });
  }
  return NextResponse.json({ status: "deleted" });
}
