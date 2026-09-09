// src/app/api/team/[memberId]/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabase, requireProjectTab } from "@/lib/supabase-api";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

// Same grantable set as dashboard/[projectId]/tabs-config.js's TAB_CONFIG
// keys (minus "team") — keep in sync.
// Team management is deliberately excluded: granting it would let an agent
// add/remove teammates or change roles, which is a privilege-escalation risk.
const GRANTABLE_PERMISSIONS = [
  "documents", "integrations", "flows", "analytics",
  "campaigns", "templates", "shop", "appointments", "events",
];

// Changing roles and removing teammates were the only team writes with no
// throttle at all — only the invite path called the limiter. The counter
// lives in the backend because a Next.js route is serverless and an
// in-memory counter here wouldn't survive between requests.
async function rateLimited(req) {
  const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    const res = await fetch(`${BACKEND}/auth/rate-limit-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": visitorIp },
      body: JSON.stringify({ action: "team_manage" }),
    });
    return !res.ok;
  } catch {
    // The limiter being unreachable must not take team management down.
    console.error("team rate-limit check unreachable; allowing request");
    return false;
  }
}

// Was requireManagerFor, which called getProjectRole and then re-derived the
// owner/admin rule inline. requireProjectTab applies the shared grid, where
// "team" is already owner/admin-only — one definition instead of two.
async function gateForMember(userId, memberId) {
  const { data: member } = await supabaseAdmin
    .from("project_members")
    .select("project_id")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return requireProjectTab(userId, member.project_id, { tab: "team" });
}

export async function PATCH(req, { params }) {
  const { memberId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (await rateLimited(req)) {
    return NextResponse.json({ error: "Too many changes — please wait and try again." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { role, permissions } = body;

  const update = {};

  if (role !== undefined) {
    if (!["admin", "agent"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    update.role = role;
    // Promoting to admin makes custom permissions moot (admins have full
    // access already) — clear them so a later demotion back to agent
    // doesn't silently resurrect a stale grant.
    if (role === "admin") update.permissions = null;
  }

  if (permissions !== undefined) {
    if (!Array.isArray(permissions) || permissions.some(p => !GRANTABLE_PERMISSIONS.includes(p))) {
      return NextResponse.json({ error: "Invalid permissions" }, { status: 400 });
    }
    update.permissions = [...new Set(permissions)];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const gate = await gateForMember(user.id, memberId);
  if (!gate.ok) return gate.response;

  const { data, error } = await supabaseAdmin
    .from("project_members")
    .update(update)
    .eq("id", memberId)
    .select()
    .maybeSingle();

  // Was `error.message` verbatim, which handed raw Postgres text to the
  // browser.
  if (error) {
    console.error("team member update failed:", error);
    return NextResponse.json({ error: "Could not save that change." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Update affected no rows — check permissions" }, { status: 403 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req, { params }) {
  const { memberId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (await rateLimited(req)) {
    return NextResponse.json({ error: "Too many changes — please wait and try again." }, { status: 429 });
  }

  const gate = await gateForMember(user.id, memberId);
  if (!gate.ok) return gate.response;

  const { data: deleted, error } = await supabaseAdmin
    .from("project_members")
    .delete()
    .eq("id", memberId)
    .select();

  if (error) {
    console.error("team member delete failed:", error);
    return NextResponse.json({ error: "Could not remove that teammate." }, { status: 500 });
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Delete affected no rows — check permissions" }, { status: 403 });
  }
  return NextResponse.json({ success: true });
}
