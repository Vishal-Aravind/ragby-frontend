import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { searchParams } = new URL(req.url);

  const projectId = searchParams.get("projectId");
  const q = searchParams.get("q");

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, chat_id, content")
    .ilike("content", `%${q}%`);

  if (error) return NextResponse.json([], { status: 500 });

  const grouped = {};
  data.forEach(m => {
    if (!grouped[m.chat_id]) grouped[m.chat_id] = [];
    grouped[m.chat_id].push(m);
  });

  const { data: chats } = await supabase
    .from("chats")
    .select("*")
    .eq("project_id", projectId);

  return NextResponse.json(
    chats
      .filter(c => grouped[c.id])
      .map(c => ({ ...c, matches: grouped[c.id] }))
  );
}
