// src/app/api/api-keys/[projectId]/regenerate/route.js
import { NextResponse } from "next/server";
import { getSupabase, getToken } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function POST(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getToken(supabase);
  return proxyToBackend(`/api-keys/${projectId}/regenerate`, { token, method: "POST" });
}
