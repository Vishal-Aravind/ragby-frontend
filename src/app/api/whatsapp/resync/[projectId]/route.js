// ─────────────────────────────────────────────────────────
// app/api/whatsapp/resync/[projectId]/route.js
// Deliberately separate from resubscribe — Meta rate-limits the sync API
// per phone number, so this must stay a standalone, deliberate action,
// never auto-triggered. See backend/whatsapp.py's whatsapp_resync.
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function POST(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(
    `${process.env.BACKEND_BASE_URL}/whatsapp/resync/${projectId}`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${session.access_token}` },
    }
  );

  return NextResponse.json(await res.json(), { status: res.status });
}
