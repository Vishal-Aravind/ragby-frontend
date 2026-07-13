// src/app/api/analytics/unanswered-questions/route.js
//
// Derives the "unanswered questions" list on the fly from existing
// chat_messages — no separate logging table needed. Whenever the bot's
// fallback string appears, the message right before it (from the
// customer) is the question that couldn't be answered. Grouped by exact
// question text and cross-referenced against content_gap_resolutions to
// know what's already been handled.
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const FALLBACK_TEXT = "I couldn't find that in your documents or data sources.";

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

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  // Every real customer-facing channel — deliberately excludes "inapp"
  // (the internal Test Chat tool), since testing your own bot isn't a
  // customer pain point.
  const { data: chats } = await supabase
    .from("chats")
    .select("id")
    .eq("project_id", project_id)
    .neq("channel", "inapp");

  const chatIds = (chats || []).map(c => c.id);
  if (chatIds.length === 0) return NextResponse.json({ groups: [] });

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("chat_id, role, content, created_at")
    .in("chat_id", chatIds)
    .order("chat_id", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: resolutions } = await supabase
    .from("content_gap_resolutions")
    .select("question_key")
    .eq("project_id", project_id);

  const resolvedKeys = new Set((resolutions || []).map(r => r.question_key));

  // Walk each chat's messages in order; whenever the fallback fires,
  // the immediately preceding user message is the unanswered question.
  const byChat = {};
  for (const m of (messages || [])) {
    if (!byChat[m.chat_id]) byChat[m.chat_id] = [];
    byChat[m.chat_id].push(m);
  }

  const grouped = {}; // key -> { question, count, last_asked_at }
  for (const chatMsgs of Object.values(byChat)) {
    for (let i = 1; i < chatMsgs.length; i++) {
      const curr = chatMsgs[i];
      const prev = chatMsgs[i - 1];
      if (curr.role !== "assistant" || curr.content !== FALLBACK_TEXT) continue;
      if (prev.role !== "user" || !prev.content?.trim()) continue;

      const question = prev.content.trim();
      const key = question.toLowerCase();
      if (!grouped[key]) grouped[key] = { question, count: 0, last_asked_at: prev.created_at };
      grouped[key].count += 1;
      if (new Date(prev.created_at) > new Date(grouped[key].last_asked_at)) {
        grouped[key].last_asked_at = prev.created_at;
      }
    }
  }

  const groups = Object.entries(grouped).map(([key, g]) => ({
    key,
    question: g.question,
    count: g.count,
    last_asked_at: g.last_asked_at,
    resolved: resolvedKeys.has(key),
  }));

  groups.sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.last_asked_at) - new Date(a.last_asked_at);
  });

  return NextResponse.json({ groups });
}

// Plain "mark resolved" — no document created, just dismisses it.
export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { project_id, question } = await req.json();
  if (!project_id || !question) {
    return NextResponse.json({ error: "project_id and question required" }, { status: 400 });
  }

  const { error } = await supabase.from("content_gap_resolutions").upsert({
    project_id,
    question_key: question.trim().toLowerCase(),
    resolved_by: user.id,
  }, { onConflict: "project_id,question_key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "resolved" });
}
