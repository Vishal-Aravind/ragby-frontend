//app\api\chats\[chatId]\route.js

import { NextResponse } from "next/server";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";

// FIX: previously neither handler checked auth OR ownership at all — any
// request could rename/delete any project's chat by guessing a chatId.
async function requireRoleForChat(supabase, userId, chatId) {
  const { data: chat } = await supabase.from("chats").select("project_id").eq("id", chatId).maybeSingle();
  if (!chat) return null;
  return getProjectRole(userId, chat.project_id);
}

export async function PUT(req, { params }) {
  const { chatId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await requireRoleForChat(supabase, user.id, chatId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title } = await req.json();

  const { data, error } = await supabase
    .from("chats")
    .update({ title })
    .eq("id", chatId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}


export async function DELETE(req, { params }) {
  const { chatId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await requireRoleForChat(supabase, user.id, chatId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabase.from("chat_messages").delete().eq("chat_id", chatId);
  await supabase.from("chats").delete().eq("id", chatId);

  return NextResponse.json({ success: true });
}
