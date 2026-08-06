// ─────────────────────────────────────────────────────────
// app/api/slack/connect/route.js
// Gets the Slack OAuth URL and redirects user
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");

  // FIX: previously any logged-in user could pass any project_id here and
  // start connecting Slack to a project they don't own.
  const role = await getProjectRole(session.user.id, projectId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await fetch(
    `${process.env.BACKEND_BASE_URL}/slack/auth-url?project_id=${projectId}`,
    { headers: { "Authorization": `Bearer ${session.access_token}` } }
  );
 
  const data = await res.json();
  return NextResponse.json(data);
}
 