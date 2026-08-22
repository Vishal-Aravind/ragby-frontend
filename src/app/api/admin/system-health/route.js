import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { requireStaff, supabaseAdmin } from "@/lib/admin-auth";
import { PLAN_LIMITS } from "@/lib/pricing";

const JOB_NAMES = [
  "appointment_reminders",
  "scheduled_campaigns",
  "shopify_reconciliation",
  "appointment_hold_release",
  "whatsapp_sync_monitor",
];

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const staff = await requireStaff(supabase);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const month = new Date().toISOString().slice(0, 7);

  const [jobRows, profilesRes, usageRes] = await Promise.all([
    Promise.all(
      JOB_NAMES.map(name =>
        supabaseAdmin
          .from("job_runs")
          .select("status, started_at, finished_at, detail")
          .eq("job_name", name)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    ),
    supabaseAdmin.from("profiles").select("id, name, email, plan"),
    supabaseAdmin.from("usage").select("user_id, count").eq("month", month),
  ]);

  const jobs = JOB_NAMES.map((name, i) => ({ name, lastRun: jobRows[i].data || null }));

  const profileMap = {};
  (profilesRes.data || []).forEach(p => { profileMap[p.id] = p; });

  const nearLimit = (usageRes.data || [])
    .map(u => {
      const profile = profileMap[u.user_id];
      const limit = PLAN_LIMITS[profile?.plan || "free"]?.conversations;
      if (!limit) return null;
      const pct = u.count / limit;
      return pct >= 0.8 ? { ...profile, usage: u.count, limit, pct } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct);

  return NextResponse.json({
    jobs,
    nearLimitTenants: nearLimit,
    sentryProjectUrl: process.env.NEXT_PUBLIC_SENTRY_PROJECT_URL || null,
  });
}
