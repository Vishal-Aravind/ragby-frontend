// src/app/api/team/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mirrors PLAN_LIMITS["seats"] in backend/config.py — keep in sync.
// 100 on business is "effectively unlimited" for any real SMB team without
// literally promising infinite seats forever — leaves room for a future
// Enterprise tier above it. Deliberately NOT `SEAT_LIMITS[plan] ?? free`
// below — a falsy/zero-like limit would be silently treated as "missing"
// by `??`; the `in` check only falls back for a genuinely unrecognized
// plan string.
const SEAT_LIMITS = { free: 1, pro: 5, business: 100 };
function getSeatLimit(plan) {
  return plan in SEAT_LIMITS ? SEAT_LIMITS[plan] : SEAT_LIMITS.free;
}

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

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
    .select("email, name, plan")
    .eq("id", project.user_id)
    .maybeSingle();

  const { data: members } = await supabaseAdmin
    .from("project_members")
    .select("id, user_id, email, role, status, permissions, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const seatLimit = getSeatLimit(ownerProfile?.plan);
  const activeMembers = (members || []).filter(m => m.status === "active").length;

  return NextResponse.json({
    myRole,
    owner: { id: project.user_id, email: ownerProfile?.email || null, name: ownerProfile?.name || null },
    members: members || [],
    seats: { used: 1 + activeMembers, limit: seatLimit },
    plan: ownerProfile?.plan || "free",
  });
}

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The "no account found for that email" response below is an
  // email-existence oracle — capped the same way login/signup already are.
  const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateCheck = await fetch(`${BACKEND}/auth/rate-limit-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": visitorIp },
    body: JSON.stringify({ action: "team_invite" }),
  });
  if (!rateCheck.ok) {
    return NextResponse.json({ error: "Too many invite attempts — please wait and try again." }, { status: 429 });
  }

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

  const { data: ownerProfile } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .maybeSingle();

  const seatLimit = getSeatLimit(ownerProfile?.plan);
  if (seatLimit !== null) {
    const { count: activeMembers } = await supabaseAdmin
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "active");

    const seatsUsed = 1 + (activeMembers || 0); // owner counts as a seat
    if (seatsUsed >= seatLimit) {
      return NextResponse.json(
        { error: `Your plan allows ${seatLimit} seat${seatLimit === 1 ? "" : "s"} on this project. Upgrade to invite more people.` },
        { status: 403 }
      );
    }
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

  if (error) {
    console.error("Team invite insert failed:", error);
    return NextResponse.json({ error: "Something went wrong sending that invite. Please try again." }, { status: 500 });
  }
  return NextResponse.json(created);
}