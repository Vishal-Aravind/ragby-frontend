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

  // Was echoing the raw backend body on a parse failure, which on a 500
  // meant a Python traceback rendered straight into the browser.
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    return NextResponse.json(
      res.ok ? parsed : { error: parsed.detail || "Could not cancel that campaign." },
      { status: res.status }
    );
  } catch {
    console.error("campaign cancel returned non-JSON:", text.slice(0, 500));
    return NextResponse.json({ error: "Could not cancel that campaign." }, { status: 502 });
  }
}
