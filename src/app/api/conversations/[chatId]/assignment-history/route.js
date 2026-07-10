// src/app/api/conversations/[chatId]/assignment-history/route.js
// Who assigned this conversation to whom, and when — so a chain of
// delegations (manager assigns to A, A hands it to B) is traceable.
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

export async function GET(req, { params }) {
  const { chatId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: chat } = await supabaseAdmin.from("chats").select("project_id").eq("id", chatId).maybeSingle();
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getProjectRole(user.id, chat.project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: entries, error } = await supabaseAdmin
    .from("chat_assignment_log")
    .select("id, assigned_to, assigned_by, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set(
    (entries || []).flatMap(e => [e.assigned_to, e.assigned_by]).filter(Boolean)
  )];

  let profileMap = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);
    (profiles || []).forEach(p => { profileMap[p.id] = p.name || p.email; });
  }

  const result = (entries || []).map(e => ({
    ...e,
    assigned_to_name: e.assigned_to ? (profileMap[e.assigned_to] || "Unknown") : null,
    assigned_by_name: profileMap[e.assigned_by] || "Unknown",
  }));

  return NextResponse.json(result);
}
