// src/app/api/api-keys/[projectId]/route.js
import { NextResponse } from "next/server";
import { getSupabase, getToken } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Was `if (!res.ok) return { error: "Failed" }, 500` with no try/catch, so
  // a 403 read as a server fault and an unreachable backend threw inside
  // the route.
  const token = await getToken(supabase);
  return proxyToBackend(`/api-keys/${projectId}`, { token });
}
