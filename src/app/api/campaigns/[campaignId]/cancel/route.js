// src/app/api/campaigns/[campaignId]/cancel/route.js
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_BASE_URL;

export async function POST(req, { params }) {
  const { campaignId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(`${BACKEND}/campaigns/${campaignId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const text = await res.text();
  try { return NextResponse.json(JSON.parse(text), { status: res.status }); }
  catch { return NextResponse.json({ error: text }, { status: res.status }); }
}
