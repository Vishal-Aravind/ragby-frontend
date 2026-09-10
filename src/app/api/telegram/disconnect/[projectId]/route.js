// ─────────────────────────────────────────────────────────
// app/api/telegram/disconnect/[projectId]/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function DELETE(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // This route dropped the backend's status code, so an agent without the
  // integrations permission got a 403 from FastAPI, a 200 from here, and a
  // "Telegram disconnected" toast for something that never happened.
  const access = await requireProjectTab(session.user.id, projectId, {
    tab: "integrations",
    minRole: "admin",
  });
  if (!access.ok) return access.response;

  return proxyToBackend(`/telegram/disconnect/${projectId}`, {
    token: session.access_token,
    method: "DELETE",
  });
}
