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

  // No try/catch before this: Render's free tier sleeps, so an unreachable
  // backend threw and Next served a 500 HTML page. The caller's revert path
  // then also failed, so the optimistic tag change vanished with no message.
  let res;
  try {
    res = await fetch(`${BACKEND}/leads/${encodeURIComponent(leadId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Lead tag update failed:", err);
    return NextResponse.json(
      { error: "Could not reach the server. Please try again." },
      { status: 502 }
    );
  }

  const text = await res.text();
  try { return NextResponse.json(JSON.parse(text), { status: res.status }); }
  catch {
    // Was echoing the raw body, which for an unhandled backend exception is
    // a Python traceback.
    console.error("Lead tag update returned non-JSON:", res.status, text);
    return NextResponse.json({ error: "Could not save tags." }, { status: res.status });
  }
}
