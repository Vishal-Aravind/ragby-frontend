// src/app/api/team/[memberId]/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Same grantable set as dashboard/[projectId]/tabs-config.js's TAB_CONFIG
// keys (minus "team") — keep in sync.
// Team management is deliberately excluded: granting it would let an agent
// add/remove teammates or change roles, which is a privilege-escalation risk.
const GRANTABLE_PERMISSIONS = [
  "documents", "integrations", "flows", "analytics", "api",
  "campaigns", "templates", "shop", "appointments", "events",
];

async function requireManagerFor(userId, memberId) {
  const { data: member } = await supabaseAdmin
    .from("project_members")
    .select("project_id")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) return { errorResponse: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const role = await getProjectRole(userId, member.project_id);
  if (role !== "owner" && role !== "admin") {
    return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { member };
}

export async function PATCH(req, { params }) {
  const { memberId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role, permissions } = await req.json();

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
    update.permissions = permissions;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const check = await requireManagerFor(user.id, memberId);
  if (check.errorResponse) return check.errorResponse;

  const { data, error } = await supabaseAdmin
    .from("project_members")
    .update(update)
    .eq("id", memberId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req, { params }) {
  const { memberId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const check = await requireManagerFor(user.id, memberId);
  if (check.errorResponse) return check.errorResponse;

  const { error } = await supabaseAdmin.from("project_members").delete().eq("id", memberId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}