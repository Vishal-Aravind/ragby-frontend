//app\api\chats\[chatId]\messages\route.js

import { NextResponse } from "next/server";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";

export async function GET(req, { params }) {
  const { supabase } = getSupabase(req);
  const { chatId } = await params;   // ✅ correct

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // FIX: previously any logged-in user could read any project's chat
  // transcript by guessing/incrementing a chatId.
  const { data: chat } = await supabase.from("chats").select("project_id").eq("id", chatId).maybeSingle();
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await getProjectRole(user.id, chat.project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
