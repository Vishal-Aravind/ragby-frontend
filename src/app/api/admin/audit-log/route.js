import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { requireStaff, supabaseAdmin } from "@/lib/admin-auth";

const PAGE_SIZE = 50;

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const staff = await requireStaff(supabase);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10));
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabaseAdmin
    .from("admin_audit_log")
    .select("id, staff_user_id, action, target_type, target_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (action) query = query.eq("action", action);

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const staffIds = [...new Set((rows || []).map(r => r.staff_user_id))];
  const { data: staffProfiles } = staffIds.length
    ? await supabaseAdmin.from("profiles").select("id, name, email").in("id", staffIds)
    : { data: [] };

  const staffMap = {};
  (staffProfiles || []).forEach(p => { staffMap[p.id] = p; });

  const entries = (rows || []).map(r => ({ ...r, staff: staffMap[r.staff_user_id] || null }));

  return NextResponse.json({ entries, page, hasMore: (rows || []).length === PAGE_SIZE });
}
