// app/api/flows/[flowId]/stats/route.js
// Per-node "reached / dropped here" counts for a website flow (last 30 days).
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";

export async function GET(req, { params }) {
  const { flowId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: flow } = await supabase.from("flows").select("project_id").eq("id", flowId).maybeSingle();
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const gate = await requireProjectTab(user.id, flow.project_id, { tab: "flows" });
  if (!gate.ok) return gate.response;

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data, error } = await supabase.rpc("web_flow_node_stats", { p_flow_id: flowId, p_since: since });
  if (error) {
    console.error("flow stats failed:", error);
    return NextResponse.json({ stats: {} });
  }
  const stats = {};
  for (const row of data || []) {
    stats[row.node_id] = { entered: Number(row.entered) || 0, dropped: Number(row.dropped) || 0 };
  }
  return NextResponse.json({ stats });
}
