// ─────────────────────────────────────────────────────────
// app/api/sources/route.js — GET list of sources
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
 
export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 
  const projectId = req.nextUrl.searchParams.get("project_id");
 
  const res = await fetch(`${process.env.BACKEND_BASE_URL}/sources?project_id=${projectId}`, {
    headers: { "Authorization": `Bearer ${session.access_token}` },
  });
 
  if (!res.ok) return NextResponse.json([], { status: res.status });
  return NextResponse.json(await res.json());
}