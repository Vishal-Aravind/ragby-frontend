import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { requireStaff, supabaseAdmin, logAdminAction } from "@/lib/admin-auth";
import { dbError } from "@/lib/api-error";

export async function POST(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const staff = await requireStaff(supabase);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("projects")
    .update({ suspended: false })
    .eq("id", projectId);
  if (error) return dbError("admin/tenants/[projectId]/reactivate", error);
  await logAdminAction(staff.user.id, "reactivate", "project", projectId);

  return NextResponse.json({ success: true });
}
