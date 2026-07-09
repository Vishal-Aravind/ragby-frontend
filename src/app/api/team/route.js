// src/app/api/team/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const myRole = await getProjectRole(user.id, projectId);
  if (!myRole) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();

  const { data: ownerProfile } = await supabaseAdmin
    .from("profiles")
    .select("email, name")
    .eq("id", project.user_id)
    .maybeSingle();

  const { data: members } = await supabaseAdmin
    .from("project_members")
    .select("id, user_id, email, role, status, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    myRole,
    owner: { id: project.user_id, email: ownerProfile?.email || null, name: ownerProfile?.name || null },
    members: members || [],
  });
}

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, email, role } = await req.json();
  if (!projectId || !email || !role) {
    return NextResponse.json({ error: "projectId, email and role are required" }, { status: 400 });
  }
  if (!["admin", "agent"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const myRole = await getProjectRole(user.id, projectId);
  if (myRole !== "owner" && myRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Only existing Zavo accounts can be invited for now — no magic-link
  // invite email flow yet, that's a later enhancement.
  const { data: invitee } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (!invitee) {
    return NextResponse.json(
      { error: "No Zavo account found for that email. Ask them to sign up first, then invite them." },
      { status: 404 }
    );
  }

  if (invitee.id === user.id) {
    return NextResponse.json({ error: "You can't invite yourself" }, { status: 400 });
  }

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();

  if (project.user_id === invitee.id) {
    return NextResponse.json({ error: "That user already owns this project" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "That person is already on the team" }, { status: 400 });
  }

  const { data: created, error } = await supabaseAdmin
    .from("project_members")
    .insert({
      project_id: projectId,
      user_id: invitee.id,
      email: normalizedEmail,
      role,
      status: "active",
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(created);
}