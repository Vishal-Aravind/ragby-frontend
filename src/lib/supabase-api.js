// lib/supabase-api.js

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { roleHasTabAccess, ROLE_RANK } from "@/lib/project-access";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export function getSupabase(req) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) =>
          res.cookies.set({ name, value, ...options }),
        remove: (name, options) =>
          res.cookies.set({ name, value: "", ...options }),
      },
    }
  );

  return { supabase, res };
}

// FIX: Separate helper that returns the access token from the session.
// Call this in API routes that need to forward the JWT to FastAPI.
export async function getToken(supabase) {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Returns "owner" | "admin" | "agent" | null for a given user + project.
// Uses the service-role client deliberately — this only checks ownership/
// membership rows, it doesn't expose any project content, so bypassing
// RLS here is safe and avoids depending on whatever RLS policy happens
// to exist on `projects` today.
export async function getProjectRole(userId, projectId) {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return null;
  if (project.user_id === userId) return "owner";

  const { data: member } = await supabaseAdmin
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return member?.role || null;
}

// Returns { role, permissions } — permissions is only meaningful for
// role "agent" (custom extra tabs granted beyond the Conversations/Leads
// default); owner/admin always have full access regardless of this array.
export async function getProjectAccess(userId, projectId) {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return { role: null, permissions: [] };
  if (project.user_id === userId) return { role: "owner", permissions: [] };

  const { data: member } = await supabaseAdmin
    .from("project_members")
    .select("role, permissions")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!member) return { role: null, permissions: [] };
  return { role: member.role, permissions: member.permissions || [] };
}

// The real authorization gate for project-scoped API routes — the JS mirror
// of backend/auth.py's require_project_access.
//
// getProjectRole only answers "does this user have SOME role here", so every
// route built on it granted an agent with zero tab permissions the same
// access as an owner. The page-level guard (hasProjectTabAccess in
// project-access.js) hid the tab but never stopped a direct call to the API.
//
// Returns { ok: true, role, permissions } or { ok: false, response } — the
// caller returns `response` directly, so the 401/403/404 wording stays
// identical across every route.
export async function requireProjectTab(userId, projectId, { tab, minRole } = {}) {
  const deny = (status, error) => ({
    ok: false,
    response: NextResponse.json({ error }, { status }),
  });

  if (!projectId || typeof projectId !== "string") {
    return deny(400, "project_id required");
  }

  const { role, permissions } = await getProjectAccess(userId, projectId);
  if (!role) return deny(403, "Forbidden");

  if (minRole && (ROLE_RANK[role] || 0) < (ROLE_RANK[minRole] || 99)) {
    return deny(403, "You don't have permission to do this. Ask a project admin.");
  }

  if (tab && !roleHasTabAccess(role, permissions, tab)) {
    return deny(403, "You don't have access to this section of the project.");
  }

  return { ok: true, role, permissions };
}