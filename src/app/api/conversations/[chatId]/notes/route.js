// src/app/api/conversations/[chatId]/notes/route.js
// Internal team notes on a conversation — never sent to the customer.
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

async function checkAccess(user, chatId) {
  const { data: chat } = await supabaseAdmin.from("chats").select("project_id").eq("id", chatId).maybeSingle();
  if (!chat) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const role = await getProjectRole(user.id, chat.project_id);
  if (!role) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { chat };
}

export async function GET(req, { params }) {
  const { chatId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await checkAccess(user, chatId);
  if (check.error) return check.error;

  const { data: notes, error } = await supabaseAdmin
    .from("chat_notes")
    .select("id, content, author_id, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach a display name for each author (email from profiles).
  const authorIds = [...new Set((notes || []).map(n => n.author_id))];
  let profileMap = {};
  if (authorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", authorIds);
    (profiles || []).forEach(p => { profileMap[p.id] = p; });
  }

  const result = (notes || []).map(n => ({
    ...n,
    author_name: profileMap[n.author_id]?.name || profileMap[n.author_id]?.email || "Unknown",
  }));

  return NextResponse.json(result);
}

export async function POST(req, { params }) {
  const { chatId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "Note content required" }, { status: 400 });

  const check = await checkAccess(user, chatId);
  if (check.error) return check.error;

  const { data, error } = await supabaseAdmin
    .from("chat_notes")
    .insert({ chat_id: chatId, author_id: user.id, content: content.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}