 
// ─────────────────────────────────────────────────────────
// app/api/slack/status/[projectId]/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
 
export async function GET(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 
  const res = await fetch(
    `${process.env.BACKEND_BASE_URL}/slack/status/${projectId}`,
    { headers: { "Authorization": `Bearer ${session.access_token}` } }
  );
 
  return NextResponse.json(await res.json());
}
 