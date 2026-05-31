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

  // Get all chats for this project
  const { data: chats } = await supabase
    .from("chats")
    .select("id, created_at")
    .eq("project_id", project_id)
    .eq("channel", "whatsapp");

  const chatIds = (chats || []).map(c => c.id);

  if (chatIds.length === 0) {
    return NextResponse.json({
      stats: {
        total_conversations: 0, total_messages: 0,
        user_messages: 0, bot_messages: 0,
        flow_triggers: 0, handoffs: 0,
      },
      chart: [],
    });
  }

  // Get all messages
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at, chat_id")
    .in("chat_id", chatIds)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const msgs = messages || [];

  // Stats
  const total_conversations = chatIds.length;
  const total_messages = msgs.length;
  const user_messages = msgs.filter(m => m.role === "user").length;
  const bot_messages = msgs.filter(m => m.role === "assistant").length;
  const flow_triggers = msgs.filter(m => m.role === "user" && ["hi","hello","hey","start","menu"].includes(m.content?.toLowerCase()?.trim())).length;
  const handoffs = msgs.filter(m => m.content?.includes("[tapped: talk_to_human]") || m.content?.includes("Connecting you to our team")).length;

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
    stats: { total_conversations, total_messages, user_messages, bot_messages, flow_triggers, handoffs },
    chart: Object.values(chartMap),
  });
}