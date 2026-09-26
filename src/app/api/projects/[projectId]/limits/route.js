// app/api/projects/[projectId]/limits/route.js
//
// Exposes the project owner's plan limits (document/source counts, max
// file size) so the frontend can pre-check an upload against the REAL
// per-plan ceiling instead of the flat MAX_DOCUMENT_BYTES every plan used
// to share. Backed by backend/usage.py's get_plan_limits(project_id),
// which resolves by project OWNER, not caller — a teammate uploading into
// someone else's project is checked against the owner's plan.

import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const { projectId } = await params;

  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return proxyToBackend(`/projects/${projectId}/limits`, { token: session.access_token });
}
