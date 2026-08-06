// src/app/api/flows/nodes/[nodeId]/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getProjectRole } from "@/lib/supabase-api";

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
    response,
  };
}

async function requireRoleForNode(supabase, userId, nodeId) {
  const { data: node } = await supabase.from("flow_nodes").select("flow_id").eq("id", nodeId).maybeSingle();
  if (!node) return null;
  const { data: flow } = await supabase.from("flows").select("project_id").eq("id", node.flow_id).maybeSingle();
  if (!flow) return null;
  return getProjectRole(userId, flow.project_id);
}

export async function PUT(req, { params }) {
  const { nodeId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await requireRoleForNode(supabase, user.id, nodeId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const update = {};
  if ("type" in body) update.type = body.type;
  if ("content" in body) update.content = body.content;
  if ("is_start" in body) update.is_start = body.is_start;

  const { data, error } = await supabase.from("flow_nodes").update(update).eq("id", nodeId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req, { params }) {
  const { nodeId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await requireRoleForNode(supabase, user.id, nodeId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabase.from("flow_nodes").delete().eq("id", nodeId);
  return NextResponse.json({ status: "deleted" });
}