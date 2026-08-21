import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { requireStaff, supabaseAdmin } from "@/lib/admin-auth";

// Billing is per-user (profiles.plan/razorpay_*), not per-project — a user
// can own multiple projects, so this is intentionally separate from the
// per-tenant list in /api/admin/tenants.
export async function GET(req) {
  const { supabase } = getSupabase(req);
  const staff = await requireStaff(supabase);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, name, email, plan, razorpay_customer_id, razorpay_subscription_id, created_at")
    .neq("plan", "free")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ customers: data || [] });
}
