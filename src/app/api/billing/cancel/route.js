// ─────────────────────────────────────────────────────────
// app/api/billing/cancel/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase, getToken } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const token = await getToken(supabase);
  return proxyToBackend("/billing/cancel", { token, method: "POST", body });
}
