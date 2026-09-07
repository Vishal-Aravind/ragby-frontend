// ─────────────────────────────────────────────────────────
// app/api/whatsapp/status/[projectId]/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
 
export async function GET(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 
  const res = await fetch(
    `${process.env.BACKEND_BASE_URL}/whatsapp/status/${projectId}`,
    { headers: { "Authorization": `Bearer ${session.access_token}` } }
  );
 
  // Was dropping res.status, so a 403 or 500 reached the browser as a 200
  // and the dashboard rendered "not connected" for an already-connected
  // project, inviting a pointless re-onboard.
  return NextResponse.json(await res.json(), { status: res.status });
}
 