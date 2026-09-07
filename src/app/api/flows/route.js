// src/app/api/flows/route.js
import { NextResponse } from "next/server";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import {
  MAX_FLOWS_PER_PROJECT,
  normalizeTriggerKeywords,
  validateFlowName,
} from "@/lib/flow-validation";

const DEFAULT_KEYWORDS = ["hi", "hello", "hey", "start", "menu"];

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");

  // Was getProjectRole, which passes for ANY role — an agent with no flows
  // permission could read, and below write, the project's bot script.
  const gate = await requireProjectTab(user.id, project_id, { tab: "flows" });
  if (!gate.ok) return gate.response;

  const { data, error } = await supabase
    .from("flows")
    .select("id, name, is_active, trigger_keywords, free_questions, revision, created_at")
    .eq("project_id", project_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("flows list failed:", error);
    return NextResponse.json({ error: "Could not load flows." }, { status: 500 });
  }
  return NextResponse.json(data || []);
}

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const gate = await requireProjectTab(user.id, body?.project_id, { tab: "flows" });
  if (!gate.ok) return gate.response;

  const nameError = validateFlowName(body.name);
  if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });

  const keywords = normalizeTriggerKeywords(
    body.trigger_keywords ?? DEFAULT_KEYWORDS
  );
  if (keywords.error) {
    return NextResponse.json({ error: keywords.error }, { status: 400 });
  }

  // Nothing bounded this table. A flow is cheap to create and each one can
  // hold 300 nodes, so the ceiling is what stops a scripted loop from
  // filling the project.
  const { count } = await supabase
    .from("flows")
    .select("id", { count: "exact", head: true })
    .eq("project_id", body.project_id);

  if ((count || 0) >= MAX_FLOWS_PER_PROJECT) {
    return NextResponse.json(
      { error: `You've reached the limit of ${MAX_FLOWS_PER_PROJECT} flows for this project.` },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("flows")
    .insert({
      project_id: body.project_id,
      name: body.name.trim(),
      is_active: body.is_active === true,
      trigger_keywords: keywords.value.length ? keywords.value : DEFAULT_KEYWORDS,
      free_questions: body.free_questions === true,
    })
    .select()
    .single();

  if (error) {
    console.error("flow create failed:", error);
    return NextResponse.json({ error: "Could not create the flow." }, { status: 500 });
  }
  return NextResponse.json(data);
}
