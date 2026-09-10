// src/app/api/shopify/status/[projectId]/route.js
import { NextResponse } from "next/server";
import { getSupabase, getToken, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await requireProjectTab(user.id, projectId, { tab: "integrations" });
  if (!gate.ok) return gate.response;

  // Was `{ connected: false }` on any non-OK response, so a 403 or an
  // unreachable backend rendered as "not connected" — an empty state the
  // user would act on by trying to connect again.
  const token = await getToken(supabase);
  return proxyToBackend(`/shopify/status/${projectId}`, { token });
}
