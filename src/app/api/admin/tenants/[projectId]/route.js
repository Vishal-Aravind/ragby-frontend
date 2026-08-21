import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { requireStaff, supabaseAdmin } from "@/lib/admin-auth";
import { PLAN_LIMITS } from "@/lib/pricing";

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const staff = await requireStaff(supabase);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, domain, user_id, suspended, created_at")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const month = new Date().toISOString().slice(0, 7);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    ownerRes,
    membersRes,
    usageRes,
    whatsappRes,
    telegramRes,
    slackRes,
    shopifyRes,
    razorpayRes,
    chatsRes,
    ordersRes,
    appointmentsRes,
    leadsRes,
    eventsRes,
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, name, email, plan, razorpay_customer_id, razorpay_subscription_id, created_at").eq("id", project.user_id).maybeSingle(),
    supabaseAdmin.from("project_members").select("user_id, role, status").eq("project_id", projectId),
    supabaseAdmin.from("usage").select("count").eq("user_id", project.user_id).eq("month", month).maybeSingle(),
    supabaseAdmin.from("whatsapp_integrations").select("waba_id").eq("project_id", projectId).maybeSingle(),
    supabaseAdmin.from("telegram_integrations").select("bot_username").eq("project_id", projectId).maybeSingle(),
    supabaseAdmin.from("slack_integrations").select("team_name").eq("project_id", projectId).maybeSingle(),
    supabaseAdmin.from("shopify_integrations").select("shop_domain, last_synced_at, last_sync_error").eq("project_id", projectId).maybeSingle(),
    supabaseAdmin.from("razorpay_connections").select("razorpay_account_id, connected_at").eq("project_id", projectId).maybeSingle(),
    supabaseAdmin.from("chats").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", sevenDaysAgo),
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", sevenDaysAgo),
    supabaseAdmin.from("appointments").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", sevenDaysAgo),
    supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", sevenDaysAgo),
    supabaseAdmin.from("events").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", sevenDaysAgo),
  ]);

  const owner = ownerRes.data || null;
  const plan = owner?.plan || "free";
  const usageCount = usageRes.data?.count || 0;

  return NextResponse.json({
    project,
    owner,
    members: membersRes.data || [],
    usage: {
      count: usageCount,
      limit: PLAN_LIMITS[plan]?.conversations ?? null,
    },
    integrations: {
      whatsapp: whatsappRes.data ? { connected: true, ...whatsappRes.data } : { connected: false },
      telegram: telegramRes.data ? { connected: true, ...telegramRes.data } : { connected: false },
      slack: slackRes.data ? { connected: true, ...slackRes.data } : { connected: false },
      shopify: shopifyRes.data ? { connected: true, ...shopifyRes.data } : { connected: false },
      razorpay: razorpayRes.data ? { connected: true, ...razorpayRes.data } : { connected: false },
    },
    activityLast7Days: {
      chats: chatsRes.count || 0,
      orders: ordersRes.count || 0,
      appointments: appointmentsRes.count || 0,
      leads: leadsRes.count || 0,
      events: eventsRes.count || 0,
    },
  });
}
