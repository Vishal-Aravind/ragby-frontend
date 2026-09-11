// src/app/api/conversations/[chatId]/handback/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { requireProjectTab } from "@/lib/supabase-api";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { project_id } = body;

  const access = await requireProjectTab(user.id, project_id, {
    tab: "conversations",
  });
  if (!access.ok) return access.response;

  // chatId was accepted and then ignored, and phone_number came from the
  // body — so this could resume the bot for any number under the project
  // rather than the conversation actually named.
  const { data: chat } = await supabaseAdmin
    .from("chats")
    .select("project_id, external_id, channel")
    .eq("id", chatId)
    .maybeSingle();
  if (!chat || chat.project_id !== project_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Reset session mode back to flow — service-role client so this isn't
  // at the mercy of whatever RLS policy exists on whatsapp_sessions today;
  // access is already gated by the tab check above.
  if (chat.channel === "whatsapp" && chat.external_id) {
    await supabaseAdmin.from("whatsapp_sessions").upsert({
      project_id,
      phone_number: chat.external_id,
      mode: "flow",
    }, { onConflict: "project_id,phone_number" });
  }

  return NextResponse.json({ status: "handed_back" });
}