// src/app/api/leads/[leadId]/route.js
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_BASE_URL;

export async function PUT(req, { params }) {
  const { leadId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const res = await fetch(`${BACKEND}/leads/${leadId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  try { return NextResponse.json(JSON.parse(text), { status: res.status }); }
  catch { return NextResponse.json({ error: text }, { status: res.status }); }
}
