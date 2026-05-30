// src/app/api/conversations/[chatId]/handback/route.js
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

export async function POST(req, { params }) {
  const { chatId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { project_id, phone_number } = await req.json();

  // Reset session mode back to flow
  await supabase.from("whatsapp_sessions").upsert({
    project_id,
    phone_number,
    mode: "flow",
  }, { onConflict: "project_id,phone_number" });

  return NextResponse.json({ status: "handed_back" });
}