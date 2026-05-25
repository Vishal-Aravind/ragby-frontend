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

export async function GET(req, { params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [nodesRes, edgesRes] = await Promise.all([
    supabase.table("flow_nodes").select("*").eq("flow_id", params.flowId).order("created_at"),
    supabase.table("flow_edges").select("*").eq("flow_id", params.flowId),
  ]);

  return NextResponse.json({
    nodes: nodesRes.data || [],
    edges: edgesRes.data || [],
  });
}

export async function POST(req, { params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const res = await supabase.table("flow_nodes").insert({
    flow_id: params.flowId,
    type: body.type,
    content: body.content,
    is_start: body.is_start ?? false,
  }).select().single();

  return NextResponse.json(res.data);
}