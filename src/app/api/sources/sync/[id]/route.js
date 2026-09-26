// ─────────────────────────────────────────────────────────
// app/api/sources/sync/[id]/route.js — POST: re-sync a sheet
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function POST(req, { params }) {
  const { id } = await params; // FIX: await params in Next.js 15

  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return proxyToBackend(`/sources/sync/${id}`, { token: session.access_token, method: "POST" });
}
 