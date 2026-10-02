// ─────────────────────────────────────────────────────────
// app/api/sources/introspect/route.js — POST: introspect DB schema
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

  // Through proxyToBackend so a backend error arrives as a plain
  // {detail: "..."} — this route used to forward the raw response text,
  // and the browser showed the JSON wrapper itself as the message.
  return proxyToBackend("/sources/introspect", { token: session.access_token, method: "POST", body });
}
