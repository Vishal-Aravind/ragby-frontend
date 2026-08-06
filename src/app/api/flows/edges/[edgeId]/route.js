// src/app/api/flows/edges/[edgeId]/route.js
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

export async function DELETE(req, { params }) {
  const { edgeId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: edge } = await supabase.from("flow_edges").select("flow_id").eq("id", edgeId).maybeSingle();
  if (!edge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: flow } = await supabase.from("flows").select("project_id").eq("id", edge.flow_id).maybeSingle();
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await getProjectRole(user.id, flow.project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabase.from("flow_edges").delete().eq("id", edgeId);
  return NextResponse.json({ status: "deleted" });
}