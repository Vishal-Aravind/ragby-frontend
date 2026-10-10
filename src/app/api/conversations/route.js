// src/app/api/conversations/route.js
//
// One inbox: WhatsApp chats and website chats (the embedded widget, with
// or without a website flow) in a single list, each with
// its channel, the contact's name once known, and whether a person needs to
// reply (session_mode === "human").
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getProjectRole } from "@/lib/supabase-api";

const MAX_CHATS = 300;

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

  const role = await getProjectRole(user.id, project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: chats } = await supabase
    .from("chats")
    .select("id, external_id, channel, title, created_at, assigned_to, human_mode, visitor_id")
    .eq("project_id", project_id)
    .in("channel", ["whatsapp", "public"])
    .order("created_at", { ascending: false })
    .limit(MAX_CHATS);

  if (!chats?.length) return NextResponse.json([]);

  const chatIds = chats.map(c => c.id);
  const waChats = chats.filter(c => c.channel === "whatsapp");
  const webChats = chats.filter(c => c.channel === "public");
  const phones = waChats.map(c => c.external_id).filter(Boolean);
  const visitors = webChats.map(c => c.visitor_id).filter(Boolean);

  const [msgsRes, waSessRes, webSessRes, leadsByPhone, leadsByVisitor] = await Promise.all([
    supabase.from("chat_messages").select("chat_id, content, created_at")
      .in("chat_id", chatIds).order("created_at", { ascending: false }).limit(3000),
    phones.length
      ? supabase.from("whatsapp_sessions").select("phone_number, mode").eq("project_id", project_id).in("phone_number", phones)
      : { data: [] },
    webChats.length
      ? supabase.from("web_flow_sessions").select("chat_id, mode, visitor_id").eq("project_id", project_id).in("chat_id", webChats.map(c => c.id))
      : { data: [] },
    phones.length
      ? supabase.from("leads").select("phone, name").eq("project_id", project_id).in("phone", phones)
      : { data: [] },
    visitors.length
      ? supabase.from("leads").select("session_id, name, phone").eq("project_id", project_id).in("session_id", visitors)
      : { data: [] },
  ]);

  const lastMsg = {};
  for (const m of msgsRes.data || []) if (!lastMsg[m.chat_id]) lastMsg[m.chat_id] = m;
  const waMode = Object.fromEntries((waSessRes.data || []).map(s => [s.phone_number, s.mode]));
  const webSess = Object.fromEntries((webSessRes.data || []).map(s => [s.chat_id, s]));
  const nameByPhone = Object.fromEntries((leadsByPhone.data || []).map(l => [l.phone, l.name]));
  const leadByVisitor = Object.fromEntries((leadsByVisitor.data || []).map(l => [l.session_id, l]));

  const result = chats.map(c => {
    const web = c.channel === "public";
    const flow = webSess[c.id];
    const lead = web ? leadByVisitor[c.visitor_id || flow?.visitor_id] : null;
    const mode = web ? (c.human_mode || flow?.mode === "human" ? "human" : flow?.mode || null) : (waMode[c.external_id] || null);
    const last = lastMsg[c.id]?.content || null;
    return {
      ...c,
      channel_label: web ? "website" : "whatsapp",
      // Website visitors have no number: their name once they've shared it,
      // otherwise a short stable label. Display only — actions use the id.
      display_name: web
        ? (lead?.name || `Visitor ${c.id.slice(0, 4).toUpperCase()}`)
        : (nameByPhone[c.external_id] ? `${nameByPhone[c.external_id]}` : c.external_id),
      contact_phone: web ? (lead?.phone || null) : c.external_id,
      last_message: last ? (last.startsWith("[Human] ") ? last.slice(8) : last).slice(0, 60) : null,
      last_message_at: lastMsg[c.id]?.created_at || c.created_at,
      session_mode: mode,
    };
  });

  result.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  return NextResponse.json(result);
}
