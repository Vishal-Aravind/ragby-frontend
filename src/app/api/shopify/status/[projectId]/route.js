// ─────────────────────────────────────────────────────────
// app/api/shopify/status/[projectId]/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(
    `${process.env.BACKEND_BASE_URL}/shopify/status/${projectId}`,
    { headers: { "Authorization": `Bearer ${session.access_token}` } }
  );

  if (!res.ok) return NextResponse.json({ connected: false }, { status: res.status });
  return NextResponse.json(await res.json());
}
