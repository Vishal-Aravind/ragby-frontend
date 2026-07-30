// src/app/api/analytics/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getSupabase(req) {
  const response = NextResponse.next();
  return {
    supabase: createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name) => req.cookies.get(name)?.value,
          set: (name, value, options) => response.cookies.set({ name, value, ...options }),
          remove: (name, options) => response.cookies.set({ name, value: "", ...options }),
        },
      }
    ),
  };
}

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const cutoffISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Every real customer-facing channel — excludes "inapp" (the internal Test
  // Chat tool), matching the convention already used in
  // unanswered-questions/route.js and chats/route.js. Previously this only
  // counted "whatsapp", making Telegram/Slack/website-widget activity
  // invisible here.
  const { data: chats } = await supabase
    .from("chats")
    .select("id")
    .eq("project_id", project_id)
    .neq("channel", "inapp");

  const chatIds = (chats || []).map(c => c.id);

  // Orders/appointments/registrations can exist with ZERO associated chats
  // (the public storefront/booking/registration pages are unauthenticated
  // and don't require a conversation first) — so these must always run,
  // never gated behind "does this project have any chats."
  const [messagesRes, ordersRes, apptRes, regRes, shopConfigRes] = await Promise.all([
    chatIds.length
      ? supabase.from("chat_messages")
          .select("id, role, content, created_at, chat_id")
          .in("chat_id", chatIds)
          .gte("created_at", cutoffISO)
      : Promise.resolve({ data: [] }),

    // Revenue = only orders actually PAID for. status and payment_status are
    // independently settable, so .neq("status","cancelled") guards against a
    // cancelled-but-still-flagged-paid edge case (e.g. a refund in progress).
    supabase.from("orders")
      .select("total")
      .eq("project_id", project_id)
      .eq("payment_status", "paid")
      .neq("status", "cancelled")
      .gte("created_at", cutoffISO),

    // Note: a reschedule marks the OLD row "rescheduled" and inserts a new
    // "confirmed" row, so a single reschedule can count as 2 "bookings"
    // here — an accepted approximation, consistent with this whole panel
    // being an honest aggregate estimate rather than precise attribution.
    supabase.from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project_id)
      .neq("status", "cancelled")
      .gte("created_at", cutoffISO),

    supabase.from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project_id)
      .neq("status", "cancelled")
      .gte("created_at", cutoffISO),

    supabase.from("shop_config")
      .select("currency")
      .eq("project_id", project_id)
      .maybeSingle(),
  ]);

  const msgs = messagesRes.data || [];

  // Derived from messages actually IN the 30-day window, not from the
  // undated chats query above — previously this was silently all-time
  // while the header said "Last 30 days," and the new conversion-rate
  // metric needs a same-window denominator or it would understate
  // conversion for any project with history older than 30 days.
  const total_conversations = new Set(msgs.map(m => m.chat_id)).size;
  const total_messages = msgs.length;
  const user_messages = msgs.filter(m => m.role === "user").length;
  const bot_messages = msgs.filter(m => m.role === "assistant").length;
  // "Connecting you to our team..." is a merchant-editable flow-node body —
  // this half of the match can undercount if a merchant rewords their
  // handoff node. [tapped: talk_to_human] is the reliable half (derived
  // from a reserved, non-customizable trigger ID).
  const handoffs = msgs.filter(m =>
    m.content?.includes("[tapped: talk_to_human]") ||
    m.content?.includes("Connecting you to our team")
  ).length;

  const revenue = (ordersRes.data || []).reduce((sum, o) => sum + (o.total || 0), 0);
  const order_count = (ordersRes.data || []).length;
  const appointment_count = apptRes.count || 0;
  const registration_count = regRes.count || 0;
  const currency = shopConfigRes.data?.currency || "₹";

  const outcomeTotal = order_count + appointment_count + registration_count;
  const conversion_rate = total_conversations > 0 ? outcomeTotal / total_conversations : null;

  // Chart data — messages per day last 14 days
  const chartMap = {};
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    chartMap[key] = { date: key, user: 0, bot: 0 };
  }

  msgs.forEach(m => {
    const day = m.created_at?.split("T")[0];
    if (chartMap[day]) {
      if (m.role === "user") chartMap[day].user++;
      else chartMap[day].bot++;
    }
  });

  return NextResponse.json({
    stats: { total_conversations, total_messages, user_messages, bot_messages, handoffs },
    chart: Object.values(chartMap),
    outcomes: {
      window_days: 30,
      currency,
      revenue,
      order_count,
      appointment_count,
      registration_count,
      conversion_rate,
    },
  });
}
