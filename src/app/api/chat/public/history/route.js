import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const { sessionId } = await req.json();

  const { data } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("chat_id", sessionId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: data || [] });
}