// src/app/api/team/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";
import { getSeatLimit } from "@/lib/pricing";
import { visitorHeaders } from "@/lib/visitor-ip";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

// Same shape as backend/leads.py's _EMAIL_RE, which the leads work settled
// on. This alone is NOT the wildcard fix: both % and _ are legal in an
// email local part, so they pass this regex.
const EMAIL_RE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
const MAX_EMAIL_LENGTH = 254;

// The actual wildcard fix. The invite lookup below matches case-
// insensitively with .ilike(), where % and _ are LIKE metacharacters — so
// "a%@x.com" matched every profile starting with "a". That is an existence
// oracle over the whole profiles table and, when exactly one row matched, a
// way to invite someone whose address you never knew.
//
// Escaping rather than switching to .eq() is deliberate: signup stores
// profiles.email verbatim (see api/auth/signup/route.js), so an exact match
// on the lowercased value would stop finding anyone who signed up with a
// capital letter in their address.
function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  // Was getProjectRole, which returns ANY role — so an agent, who can't even
  // see this tab, could read every teammate's email plus the owner's by
  // calling the API directly. "team" is owner/admin-only in the shared grid.
  const gate = await requireProjectTab(user.id, projectId, { tab: "team" });
  if (!gate.ok) {
    // 404 rather than 403 for a non-member: don't confirm the id exists.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    myRole: gate.role,
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
  try {
    const rateCheck = await fetch(`${BACKEND}/auth/rate-limit-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...visitorHeaders(req) },
      body: JSON.stringify({ action: "team_invite" }),
    });
    if (!rateCheck.ok) {
      return NextResponse.json({ error: "Too many invite attempts — please wait and try again." }, { status: 429 });
    }
  } catch {
    console.error("invite rate-limit check unreachable; allowing invite");
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { projectId, email, role } = body;

  if (!projectId || !email || !role) {
    return NextResponse.json({ error: "projectId, email and role are required" }, { status: 400 });
  }
  if (!["admin", "agent"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(normalizedEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const gate = await requireProjectTab(user.id, projectId, { tab: "team" });
  if (!gate.ok) return gate.response;

  // Case-insensitive match on a value whose LIKE metacharacters are escaped
  // — see escapeLikePattern above. The error is no longer discarded either:
  // previously a multi-row failure here was indistinguishable from "no such
  // account", so two profiles differing only in case read as "not found".
  const { data: invitee, error: inviteeError } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .ilike("email", escapeLikePattern(normalizedEmail))
    .maybeSingle();

  if (inviteeError) {
    console.error("invitee lookup failed:", inviteeError);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

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
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (project.user_id === invitee.id) {
    return NextResponse.json({ error: "That user already owns this project" }, { status: 400 });
  }

  const { data: ownerProfile } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .maybeSingle();

  // Seat counting and the insert happen together, inside one transaction
  // that locks the project row first. As two statements (count, then
  // insert) two invites fired at the last free seat both passed.
  const { data: created, error } = await supabaseAdmin.rpc("add_project_member", {
    p_project_id: projectId,
    p_user_id: invitee.id,
    p_email: normalizedEmail,
    p_role: role,
    p_invited_by: user.id,
    p_seat_limit: getSeatLimit(ownerProfile?.plan),
  });

  if (error) {
    const message = error.message || "";
    if (message.includes("seat_limit_reached")) {
      const seatLimit = getSeatLimit(ownerProfile?.plan);
      return NextResponse.json(
        { error: `Your plan allows ${seatLimit} seat${seatLimit === 1 ? "" : "s"} on this project. Upgrade to invite more people.` },
        { status: 403 }
      );
    }
    // The unique constraints catch a duplicate that the pre-check raced
    // past. That used to surface as a generic 500.
    if (message.includes("duplicate key") || message.includes("23505") || message.includes("already_a_member")) {
      return NextResponse.json({ error: "That person is already on the team" }, { status: 400 });
    }
    console.error("Team invite insert failed:", error);
    return NextResponse.json({ error: "Something went wrong sending that invite. Please try again." }, { status: 500 });
  }

  return NextResponse.json(created);
}
