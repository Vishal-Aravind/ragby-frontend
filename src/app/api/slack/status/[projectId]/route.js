// ─────────────────────────────────────────────────────────
// app/api/slack/status/[projectId]/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Was getProjectRole, which passes for ANY role and ignores the per-member
  // tab grid the backend enforces. The status code was dropped too, so a 403
  // rendered as "not connected".
  const access = await requireProjectTab(session.user.id, projectId, {
    tab: "integrations",
  });
  if (!access.ok) return access.response;

  return proxyToBackend(`/slack/status/${projectId}`, {
    token: session.access_token,
  });
}
