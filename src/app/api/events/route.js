import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = new URL(req.url).searchParams.get("projectId");

  // There was no project check here at all — only a session. The backend
  // used require_project_role, which passes for any role, so an agent
  // locked out of Registrations could read every event by calling this.
  const access = await requireProjectTab(session.user.id, projectId, { tab: "events" });
  if (!access.ok) return access.response;

  return proxyToBackend(`/events?project_id=${encodeURIComponent(projectId)}`, {
    token: session.access_token,
  });
}

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const access = await requireProjectTab(session.user.id, body?.project_id, {
    tab: "events",
    minRole: "admin",
  });
  if (!access.ok) return access.response;

  return proxyToBackend(`/events?project_id=${encodeURIComponent(body.project_id)}`, {
    token: session.access_token,
    method: "POST",
    body,
  });
}
