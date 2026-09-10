// src/app/api/shopify/connect/route.js
import { NextResponse } from "next/server";
import { getSupabase, getToken, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const shop = req.nextUrl.searchParams.get("shop");

  // Was interpolated unchecked, so a missing value reached the backend as
  // the literal string "null".
  if (!shop) {
    return NextResponse.json({ error: "Enter your shop domain like mystore.myshopify.com" }, { status: 400 });
  }

  // Was getProjectRole, which passes for ANY role. The backend does enforce
  // the integrations tab and admin, so this is defence in depth rather than
  // an open door — but it should agree with every other route.
  const gate = await requireProjectTab(user.id, projectId, { tab: "integrations", minRole: "admin" });
  if (!gate.ok) return gate.response;

  const token = await getToken(supabase);
  const qs = new URLSearchParams({ project_id: projectId, shop });
  return proxyToBackend(`/shopify/oauth/start?${qs}`, { token });
}
