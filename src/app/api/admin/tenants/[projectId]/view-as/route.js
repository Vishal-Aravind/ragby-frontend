import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { requireStaff, supabaseAdmin, logAdminAction } from "@/lib/admin-auth";

const SESSION_MINUTES = 30;

// Mints a time-boxed, audit-logged "view as" session. Deliberately does NOT
// forge a real Supabase auth session or grant access to any of the
// dashboard's ~30 existing project-scoped API routes — those still require
// a real project_members/owner role exactly as before. "View as" instead
// just formalizes an accountability record (who, which tenant, when, for
// how long, why) around the tenant drill-down page, which is already a
// read-only aggregation view with no mutation endpoints of its own. This
// keeps impersonation from ever needing to touch the existing dashboard's
// write paths, which is the safest version of this feature.
export async function POST(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const staff = await requireStaff(supabase);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { reason } = await req.json().catch(() => ({}));
  const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60 * 1000).toISOString();

  const { data: session, error } = await supabaseAdmin
    .from("admin_impersonation_sessions")
    .insert({
      staff_user_id: staff.user.id,
      target_project_id: projectId,
      reason: reason || null,
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(staff.user.id, "view_as_start", "project", projectId, { reason: reason || null, session_id: session.id });

  return NextResponse.json({ sessionId: session.id, expiresAt: session.expires_at });
}
