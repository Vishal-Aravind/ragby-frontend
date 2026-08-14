// ─────────────────────────────────────────────────────────
// app/api/billing/subscribe/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const res = await fetch(`${process.env.BACKEND_BASE_URL}/billing/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  return NextResponse.json(await res.json(), { status: res.status });
}
