// src/app/api/campaigns/check-numbers/route.js
//
// Preview for an uploaded contact file: which numbers will be used (in their
// final international form) and which are skipped and why. Nothing is sent
// or saved.
import { NextResponse } from "next/server";
import { getSupabase, getToken } from "@/lib/supabase-api";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const token = await getToken(supabase);
  try {
    const res = await fetch(`${BACKEND}/campaigns/check-numbers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: body.projectId,
        contacts: Array.isArray(body.contacts) ? body.contacts : [],
        region: body.region || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.detail || "Could not check the numbers." }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("check-numbers failed:", e);
    return NextResponse.json({ error: "Could not reach the server." }, { status: 502 });
  }
}
