// ─────────────────────────────────────────────────────────
// app/api/whatsapp/onboard/route.js
// Exchanges OAuth code for token via backend
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

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

  // The body was forwarded unread, so this layer never checked that the
  // caller may connect WhatsApp to the project it names. A Meta OAuth code
  // should not travel that far on an unauthorized request.
  const access = await requireProjectTab(session.user.id, body?.projectId, {
    tab: "integrations",
    minRole: "admin",
  });
  if (!access.ok) return access.response;

  return proxyToBackend("/whatsapp/onboard", {
    token: session.access_token,
    method: "POST",
    body: {
      code: body?.code,
      projectId: body?.projectId,
      isCoexistence: body?.isCoexistence,
      wabaIdHint: body?.wabaIdHint,
    },
  });
}
