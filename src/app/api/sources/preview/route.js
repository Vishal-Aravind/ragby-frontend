// ─────────────────────────────────────────────────────────
// app/api/sources/preview/route.js — POST: read a Google Sheet's columns
// before connecting it (nothing is stored or indexed)
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  return proxyToBackend("/sources/preview", { token: session.access_token, method: "POST", body });
}
