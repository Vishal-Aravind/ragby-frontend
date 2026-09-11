// src/app/api/conversations/[chatId]/takeover/route.js
// Lets a team member proactively pause the bot and take over a
// conversation — the mirror of "hand back to bot", but triggered by the
// team instead of the customer tapping "Talk to Human".
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

  // Was getProjectRole, which passes for ANY role and ignores the per-member
  // tab grid — so an agent with no conversations permission could take over
  // a chat and pause the bot.
  const access = await requireProjectTab(user.id, project_id, {
    tab: "conversations",
  });
  if (!access.ok) return access.response;

  // The chat was never checked against the project. Every write below is
  // keyed on chatId alone and runs with the service-role client, so a member
  // of project A could POST a chatId belonging to project B and take over an
  // unrelated tenant's conversation. The sibling reply route already does
  // exactly this check; takeover did not.
  const { data: chat } = await supabaseAdmin
    .from("chats")
    .select("assigned_to, project_id, external_id, channel")
    .eq("id", chatId)
    .maybeSingle();

  if (!chat || chat.project_id !== project_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // phone_number came from the request body, so the bot could be paused for
  // any number under this project regardless of the chat named. Take it from
  // the chat row instead.
  if (chat.channel === "whatsapp" && chat.external_id) {
    await supabaseAdmin.from("whatsapp_sessions").upsert({
      project_id,
      phone_number: chat.external_id,
      mode: "human",
    }, { onConflict: "project_id,phone_number" });
  }

  // Auto-claim the conversation for whoever took it over, but don't steal
  // it from someone who already has it assigned.
  if (!chat.assigned_to) {
    await supabaseAdmin.from("chats").update({ assigned_to: user.id }).eq("id", chatId);
    await supabaseAdmin.from("chat_assignment_log").insert({
      chat_id: chatId,
      assigned_to: user.id,
      assigned_by: user.id,
    });
  }

  return NextResponse.json({ status: "taken_over" });
}