// ─────────────────────────────────────────────────────────
// app/api/whatsapp/resubscribe/[projectId]/route.js
// One-off recovery for connections made before the app was subscribed
// to the WABA's webhooks — see backend/whatsapp.py's whatsapp_resubscribe.
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function POST(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(
    `${process.env.BACKEND_BASE_URL}/whatsapp/resubscribe/${projectId}`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${session.access_token}` },
    }
  );

  return NextResponse.json(await res.json(), { status: res.status });
}
