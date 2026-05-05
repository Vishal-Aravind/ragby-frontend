// ─────────────────────────────────────────────────────────
// app/api/telegram/connect/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase, getToken } from "@/lib/supabase-api";
 
export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 
  const body = await req.json();
 
  const res = await fetch(`${process.env.BACKEND_BASE_URL}/telegram/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
 
  const data = await res.json();
  if (!res.ok) return NextResponse.json(data, { status: res.status });
  return NextResponse.json(data);
}