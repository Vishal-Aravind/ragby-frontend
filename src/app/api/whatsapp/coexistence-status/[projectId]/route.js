// ─────────────────────────────────────────────────────────
// app/api/whatsapp/coexistence-status/[projectId]/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // This layer checked only for a session, so projectId from the URL was
  // taken entirely on trust. The backend does enforce, but WhatsApp was
  // the last integration still hand-rolled rather than using the shared
  // tab gate. Returns last_sync_error, which carries raw Meta text (fbtrace ids,
  // WABA ids), so this is admin-only to match the backend.
  const access = await requireProjectTab(session.user.id, projectId, {
    tab: "integrations",
    minRole: "admin",
  });
  if (!access.ok) return access.response;

  return proxyToBackend(`/whatsapp/coexistence-status/${projectId}`, {
    token: session.access_token,
  });
}
