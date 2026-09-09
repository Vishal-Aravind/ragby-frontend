// ─────────────────────────────────────────────────────────
// app/api/billing/invoices/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase, getToken } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getToken(supabase);
  return proxyToBackend("/billing/invoices", { token });
}
