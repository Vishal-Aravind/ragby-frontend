import { NextResponse } from "next/server";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  // FIX: this was previously the only authenticated-looking route in the
  // codebase with no session check at all, and its chat_messages query had
  // no project filter — resting entirely on RLS for both auth AND tenant
  // isolation, weaker than every other route here (which layer an explicit
  // check on top of RLS).
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const q = searchParams.get("q");

  const role = await getProjectRole(session.user.id, projectId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only search within the internal test-chat channel, matching the list
  // shown by /api/chats — keeps real customer conversations out of this tool.
  const { data: chats } = await supabase
    .from("chats")
    .select("*")
    .eq("project_id", projectId)
    .eq("channel", "inapp");

  const chatIds = (chats || []).map(c => c.id);
  if (chatIds.length === 0) return NextResponse.json([]);

  // FIX: previously queried chat_messages with no chat_id/project scope at
  // all (an unbounded ILIKE across the whole table) — now scoped to only
  // this project's own chats before searching.
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, chat_id, content")
    .in("chat_id", chatIds)
    .ilike("content", `%${q}%`);

  if (error) return NextResponse.json([], { status: 500 });

  const grouped = {};
  data.forEach(m => {
    if (!grouped[m.chat_id]) grouped[m.chat_id] = [];
    grouped[m.chat_id].push(m);
  });

  return NextResponse.json(
    chats
      .filter(c => grouped[c.id])
      .map(c => ({ ...c, matches: grouped[c.id] }))
  );
}
