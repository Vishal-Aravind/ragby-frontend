import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function GET(req, { params }) {
  const { supabase } = getSupabase(req);
  const { chatId } = await params;   // ✅ correct

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

export async function POST(req, { params }) {
  const { supabase } = getSupabase(req);
  const { chatId } = await params;   // ✅ FIX HERE

  const body = await req.json();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ chat_id: chatId, ...body })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
