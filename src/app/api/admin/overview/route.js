import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { requireStaff, supabaseAdmin } from "@/lib/admin-auth";
import { PLAN_PRICES } from "@/lib/pricing";

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const staff = await requireStaff(supabase);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const month = new Date().toISOString().slice(0, 7);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [profilesRes, projectsRes, usageRes, messagesRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, plan, created_at"),
    supabaseAdmin.from("projects").select("id, created_at, suspended"),
    supabaseAdmin.from("usage").select("count").eq("month", month),
    supabaseAdmin.from("chat_messages").select("created_at").gte("created_at", fourteenDaysAgo),
  ]);

  const profiles = profilesRes.data || [];
  const projects = projectsRes.data || [];
  const usage = usageRes.data || [];
  const messages = messagesRes.data || [];

  const planCounts = { free: 0, pro: 0, business: 0 };
  profiles.forEach(p => { planCounts[p.plan || "free"] = (planCounts[p.plan || "free"] || 0) + 1; });

  // Estimated MRR — assumes monthly billing for every paid customer, since
  // billing cycle (monthly vs. yearly) isn't stored locally, only on the
  // Razorpay subscription itself. Labeled as an estimate/upper bound in the
  // UI, not presented as exact. Uses the same PLAN_PRICES the pricing page
  // shows customers, not a second hand-typed number.
  const mrrEstimate =
    planCounts.pro * PLAN_PRICES.pro.monthlyUSD +
    planCounts.business * PLAN_PRICES.business.monthlyUSD;

  const messagesThisMonth = usage.reduce((sum, u) => sum + (u.count || 0), 0);

  // 14-day signup + message trend, bucketed by day (matches AnalyticsTab.js's
  // existing "messages per day" recharts pattern).
  const dayBuckets = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dayBuckets[d] = { date: d, signups: 0, messages: 0 };
  }
  profiles.forEach(p => {
    const d = (p.created_at || "").slice(0, 10);
    if (dayBuckets[d]) dayBuckets[d].signups += 1;
  });
  messages.forEach(m => {
    const d = (m.created_at || "").slice(0, 10);
    if (dayBuckets[d]) dayBuckets[d].messages += 1;
  });

  return NextResponse.json({
    totalUsers: profiles.length,
    totalProjects: projects.length,
    suspendedProjects: projects.filter(p => p.suspended).length,
    planCounts,
    mrrEstimate,
    messagesThisMonth,
    trend: Object.values(dayBuckets),
  });
}
