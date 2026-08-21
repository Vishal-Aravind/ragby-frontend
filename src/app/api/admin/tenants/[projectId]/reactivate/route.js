import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { requireStaff, supabaseAdmin, logAdminAction } from "@/lib/admin-auth";

export async function POST(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const staff = await requireStaff(supabase);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("projects")
    .update({ suspended: false })
    .eq("id", projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(staff.user.id, "reactivate", "project", projectId);

  return NextResponse.json({ success: true });
}
