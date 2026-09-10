// ─────────────────────────────────────────────────────────
// app/api/telegram/status/[projectId]/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Was no project check at all here, and the backend's status code was
  // discarded — a 403 came back as HTTP 200 and the tab rendered it as
  // "not connected" rather than as a permission error.
  const access = await requireProjectTab(session.user.id, projectId, {
    tab: "integrations",
  });
  if (!access.ok) return access.response;

  return proxyToBackend(`/telegram/status/${projectId}`, {
    token: session.access_token,
  });
}
