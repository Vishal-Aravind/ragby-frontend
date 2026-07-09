// src/app/api/conversations/[chatId]/assign/route.js
// Claim/assign/unassign a conversation to a specific team member.
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

  const { project_id, assigned_to } = await req.json(); // assigned_to: a user id, or null to unassign

  const { data: chat } = await supabaseAdmin.from("chats").select("project_id").eq("id", chatId).maybeSingle();
  if (!chat || chat.project_id !== project_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const role = await getProjectRole(user.id, project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Assignee must actually have access to this project too (owner, or an active member).
  if (assigned_to) {
    const assigneeRole = await getProjectRole(assigned_to, project_id);
    if (!assigneeRole) return NextResponse.json({ error: "That person doesn't have access to this project" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("chats")
    .update({ assigned_to: assigned_to || null })
    .eq("id", chatId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}