// app/api/flows/[flowId]/preview/route.js
//
// The editor's "Test" panel: runs the website flow through the real engine
// (backend /web-flows/preview) without saving anything — no chats, leads or
// analytics, AI answers stubbed, webhooks simulated unless asked for real.
import { NextResponse } from "next/server";
import { getSupabase, getToken, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export const maxDuration = 15;

export async function POST(req, { params }) {
  const { flowId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: flow } = await supabase.from("flows").select("project_id, channel").eq("id", flowId).maybeSingle();
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (flow.channel !== "web") return NextResponse.json({ error: "Only website flows can be tested here." }, { status: 400 });
  const gate = await requireProjectTab(user.id, flow.project_id, { tab: "flows" });
  if (!gate.ok) return gate.response;

  let body;
  try { body = await req.json(); } catch { body = {}; }

  const token = await getToken(supabase);
  return proxyToBackend("/web-flows/preview", {
    token, method: "POST", timeoutMs: 14000,
    body: {
      projectId: flow.project_id, flowId,
      token: typeof body.token === "string" ? body.token : null,
      action: body.action && typeof body.action === "object" ? body.action : null,
      nodeId: typeof body.nodeId === "string" ? body.nodeId : null,
      realWebhooks: body.realWebhooks === true,
    },
  });
}
