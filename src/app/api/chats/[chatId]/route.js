import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function PUT(req, { params }) {
  const { supabase } = getSupabase(req);
  const { title } = await req.json();

  const { data, error } = await supabase
    .from("chats")
    .update({ title })
    .eq("id", params.chatId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}


export async function DELETE(req, { params }) {
  const { supabase } = getSupabase(req);

  await supabase.from("chat_messages").delete().eq("chat_id", params.chatId);
  await supabase.from("chats").delete().eq("id", params.chatId);

  return NextResponse.json({ success: true });
}
