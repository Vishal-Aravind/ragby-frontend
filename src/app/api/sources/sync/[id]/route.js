// ─────────────────────────────────────────────────────────
// app/api/sources/sync/[id]/route.js — POST: re-sync a sheet
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
 
export async function POST(req, { params }) {
  const { id } = await params; // FIX: await params in Next.js 15
 
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 
  const res = await fetch(`${process.env.BACKEND_BASE_URL}/sources/sync/${id}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${session.access_token}` },
  });
 
  return NextResponse.json(await res.json());
}
 