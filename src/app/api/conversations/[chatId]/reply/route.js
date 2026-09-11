// src/app/api/conversations/[chatId]/reply/route.js
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";
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
  const { message, project_id } = body;
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  // external_id is read here rather than trusted from the body. The chat
  // was validated against the project, but phone_number was whatever the
  // client sent — so the validated chat did not actually constrain who
  // received the message.
  const { data: chat } = await supabaseAdmin
    .from("chats")
    .select("project_id, external_id, channel")
    .eq("id", chatId)
    .maybeSingle();
  if (!chat || chat.project_id !== project_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (chat.channel !== "whatsapp" || !chat.external_id) {
    return NextResponse.json({ error: "That conversation is not a WhatsApp chat." }, { status: 400 });
  }

  // Was getProjectRole, which passes for ANY role. Sending on the business's
  // WhatsApp number is an admin action, matching the backend endpoint.
  const access = await requireProjectTab(user.id, project_id, {
    tab: "conversations",
    minRole: "admin",
  });
  if (!access.ok) return access.response;

  // Get auth token for backend
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  // Was collapsing every backend status to 500, so a 429 or a refusal
  // outside the 24-hour window reached the browser as a generic server
  // error. Also had a hardcoded production URL as its fallback.
  return proxyToBackend("/whatsapp/reply", {
    token,
    method: "POST",
    body: { project_id, phone_number: chat.external_id, message },
  });
}