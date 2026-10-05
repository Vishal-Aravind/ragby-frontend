// app/api/flows/[flowId]/test-webhook/route.js
// "Test request" on a Webhook node: one real call with sample values, so the
// merchant can see the status and response before connecting it.
import { NextResponse } from "next/server";
import { getSupabase, getToken, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export const maxDuration = 15;

export async function POST(req, { params }) {
  const { flowId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: flow } = await supabase.from("flows").select("project_id").eq("id", flowId).maybeSingle();
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const gate = await requireProjectTab(user.id, flow.project_id, { tab: "flows" });
  if (!gate.ok) return gate.response;

  let body;
  try { body = await req.json(); } catch { body = {}; }
  if (!body.content || typeof body.content !== "object") {
    return NextResponse.json({ error: "Nothing to test." }, { status: 400 });
  }

  const token = await getToken(supabase);
  return proxyToBackend("/web-flows/test-webhook", {
    token, method: "POST", timeoutMs: 14000,
    body: { projectId: flow.project_id, content: body.content, variables: body.variables || {} },
  });
}
