// src/app/api/flows/[flowId]/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

export async function PUT(req, { params }) {
  const { flowId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const update = {};
  if ("name" in body) update.name = body.name;
  if ("is_active" in body) update.is_active = body.is_active;
  if ("trigger_keywords" in body) update.trigger_keywords = body.trigger_keywords;
  if ("free_questions" in body) update.free_questions = body.free_questions;

  if (body.is_active === true) {
    const { data: flow } = await supabase.from("flows").select("project_id").eq("id", flowId).single();
    if (flow) {
      await supabase.from("flows").update({ is_active: false }).eq("project_id", flow.project_id).neq("id", flowId);
    }
  }

  const { data, error } = await supabase.from("flows").update(update).eq("id", flowId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req, { params }) {
  const { flowId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("flows").delete().eq("id", flowId);
  return NextResponse.json({ status: "deleted" });
}