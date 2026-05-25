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

export async function GET(req) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const res = await supabase
    .table("flows")
    .select("id, name, is_active, trigger_keywords, created_at")
    .eq("project_id", project_id)
    .order("created_at", { ascending: false });

  return NextResponse.json(res.data || []);
}

export async function POST(req) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const res = await supabase.table("flows").insert({
    project_id: body.project_id,
    name: body.name,
    is_active: body.is_active ?? false,
    trigger_keywords: body.trigger_keywords ?? ["hi", "hello", "hey", "start", "menu"],
  }).select().single();

  return NextResponse.json(res.data);
}