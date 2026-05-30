// src/app/api/conversations/route.js
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

  const { data: chats } = await supabase
    .from("chats")
    .select("id, external_id, channel, title, created_at")
    .eq("project_id", project_id)
    .eq("channel", "whatsapp")
    .order("created_at", { ascending: false });

  if (!chats?.length) return NextResponse.json([]);

  const chatIds = chats.map(c => c.id);
  const phones  = chats.map(c => c.external_id);

  // Get last message per chat
  const { data: allMsgs } = await supabase
    .from("chat_messages")
    .select("chat_id, content, role, created_at")
    .in("chat_id", chatIds)
    .order("created_at", { ascending: false });

  const lastMsgMap = {};
  for (const msg of (allMsgs || [])) {
    if (!lastMsgMap[msg.chat_id]) lastMsgMap[msg.chat_id] = msg;
  }

  // Get session mode per phone number
  const { data: sessions } = await supabase
    .from("whatsapp_sessions")
    .select("phone_number, mode")
    .eq("project_id", project_id)
    .in("phone_number", phones);

  const sessionMap = {};
  for (const s of (sessions || [])) sessionMap[s.phone_number] = s.mode;

  const result = chats.map(c => ({
    ...c,
    last_message: lastMsgMap[c.id]?.content?.slice(0, 60) || null,
    last_message_at: lastMsgMap[c.id]?.created_at || c.created_at,
    session_mode: sessionMap[c.external_id] || null,
  }));

  result.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

  return NextResponse.json(result);
}