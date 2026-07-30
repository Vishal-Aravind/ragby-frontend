// ─────────────────────────────────────────────────────────
// app/api/shopify/connect/route.js — gets the Shopify OAuth URL
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const shop = req.nextUrl.searchParams.get("shop");

  const res = await fetch(
    `${process.env.BACKEND_BASE_URL}/shopify/oauth/start?project_id=${encodeURIComponent(projectId)}&shop=${encodeURIComponent(shop)}`,
    { headers: { "Authorization": `Bearer ${session.access_token}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
