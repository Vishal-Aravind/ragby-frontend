// src/app/api/conversations/[chatId]/takeover/route.js
// Lets a team member proactively pause the bot and take over a
// conversation — the mirror of "hand back to bot", but triggered by the
// team instead of the customer tapping "Talk to Human".
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getProjectRole } from "@/lib/supabase-api";

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

  const { project_id, phone_number } = await req.json();

  const role = await getProjectRole(user.id, project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabaseAdmin.from("whatsapp_sessions").upsert({
    project_id,
    phone_number,
    mode: "human",
  }, { onConflict: "project_id,phone_number" });

  // Auto-claim the conversation for whoever took it over, but don't steal
  // it from someone who already has it assigned.
  const { data: chat } = await supabaseAdmin.from("chats").select("assigned_to").eq("id", chatId).maybeSingle();
  if (chat && !chat.assigned_to) {
    await supabaseAdmin.from("chats").update({ assigned_to: user.id }).eq("id", chatId);
    await supabaseAdmin.from("chat_assignment_log").insert({
      chat_id: chatId,
      assigned_to: user.id,
      assigned_by: user.id,
    });
  }

  return NextResponse.json({ status: "taken_over" });
}