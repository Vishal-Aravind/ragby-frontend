// src/app/api/shopify/disconnect/[projectId]/route.js
import { NextResponse } from "next/server";
import { getSupabase, getToken, requireProjectTab } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function DELETE(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await requireProjectTab(user.id, projectId, { tab: "integrations", minRole: "admin" });
  if (!gate.ok) return gate.response;

  const token = await getToken(supabase);
  return proxyToBackend(`/shopify/disconnect/${projectId}`, { token, method: "DELETE" });
}
