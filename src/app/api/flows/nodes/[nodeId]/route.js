// ── src/app/api/flows/nodes/[nodeId]/route.js ──────────────
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUser() {
  const cookieStore = cookies();
  const token = cookieStore.get("sb-access-token")?.value;
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

export async function PUT(req, { params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const update = {};
  if ("type" in body) update.type = body.type;
  if ("content" in body) update.content = body.content;
  if ("is_start" in body) update.is_start = body.is_start;

  const res = await supabase.table("flow_nodes").update(update).eq("id", params.nodeId).select().single();
  return NextResponse.json(res.data);
}

export async function DELETE(req, { params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.table("flow_nodes").delete().eq("id", params.nodeId);
  return NextResponse.json({ status: "deleted" });
}