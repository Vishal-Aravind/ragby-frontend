// ─────────────────────────────────────────────────────────
// app/api/slack/connect/route.js
// Gets the Slack OAuth URL and redirects user
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");

  // Was getProjectRole, which passes for ANY role — so an agent locked out
  // of Integrations could still start an install. Only admins may connect.
  const access = await requireProjectTab(session.user.id, projectId, {
    tab: "integrations",
    minRole: "admin",
  });
  if (!access.ok) return access.response;

  return proxyToBackend(
    `/slack/auth-url?project_id=${encodeURIComponent(projectId)}`,
    { token: session.access_token }
  );
}
