// src/app/api/campaigns/recipient-count/route.js
//
// Backs the confirmation step before a campaign sends. The browser can't
// resolve a server-side lead filter itself, so without this the "this will
// message N people" prompt would have no real N to show.
import { NextResponse } from "next/server";
import { getSupabase, getToken } from "@/lib/supabase-api";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getToken(supabase);
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const recipientFilter = searchParams.get("recipient_filter") || "all";
  const tagFilter = searchParams.get("tag_filter") || "";

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const url = new URL(`${BACKEND}/campaigns/recipient-count`);
  url.searchParams.set("project_id", projectId);
  url.searchParams.set("recipient_filter", recipientFilter);
  if (tagFilter) url.searchParams.set("tag_filter", tagFilter);

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body.detail || "Could not count recipients." },
        { status: res.status }
      );
    }
    return NextResponse.json(await res.json());
  } catch (e) {
    console.error("recipient-count failed:", e);
    return NextResponse.json({ error: "Could not reach the server." }, { status: 502 });
  }
}
