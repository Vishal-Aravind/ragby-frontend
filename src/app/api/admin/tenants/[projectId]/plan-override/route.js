import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { requireStaff, supabaseAdmin, logAdminAction } from "@/lib/admin-auth";

const VALID_PLANS = ["free", "pro", "business"];

// Manual support-tool override of profiles.plan — deliberately does NOT
// touch Razorpay (no subscription created/changed/cancelled). This is for
// support situations (e.g. comping a customer, fixing a stuck webhook
// state), not a substitute for the real billing flow in billing.py. The
// override will be silently clobbered by the next real Razorpay webhook
// event for that customer — that's intentional, not a bug, but worth
// knowing before using it.
export async function POST(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const staff = await requireStaff(supabase);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { plan } = await req.json();
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ plan })
    .eq("id", project.user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(staff.user.id, "plan_override", "project", projectId, { plan, user_id: project.user_id });

  return NextResponse.json({ success: true });
}
