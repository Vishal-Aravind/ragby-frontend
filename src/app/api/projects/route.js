// src/app/api/projects/route.js

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) =>
          response.cookies.set({ name, value, ...options }),
        remove: (name, options) =>
          response.cookies.set({ name, value: "", ...options }),
      },
    }
  );

  // 1️⃣ Get logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2️⃣ Projects this user owns
  const { data: owned, error: ownedError } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("user_id", user.id);

  if (ownedError) {
    return NextResponse.json({ error: ownedError.message }, { status: 500 });
  }

  // 3️⃣ Projects this user was added to as a team member
  const { data: memberships } = await supabaseAdmin
    .from("project_members")
    .select("project_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");

  const roleByProjectId = {};
  (memberships || []).forEach(m => { roleByProjectId[m.project_id] = m.role; });
  const memberProjectIds = Object.keys(roleByProjectId);

  let memberProjects = [];
  if (memberProjectIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("projects")
      .select("*")
      .in("id", memberProjectIds);
    memberProjects = data || [];
  }

  // Tag each project with the caller's role so the dashboard can decide
  // what to show (e.g. only owners can delete a project).
  const taggedOwned = (owned || []).map(p => ({ ...p, myRole: "owner" }));
  const taggedMember = memberProjects.map(p => ({ ...p, myRole: roleByProjectId[p.id] || "agent" }));

  const all = [...taggedOwned, ...taggedMember].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return NextResponse.json(all);
}

export async function POST(req) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) =>
          response.cookies.set({ name, value, ...options }),
        remove: (name, options) =>
          response.cookies.set({ name, value: "", ...options }),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // One business = one account — enforced here server-side, not just in the
  // UI, since a direct client-side insert could otherwise bypass any
  // frontend-only check. Only checks projects this user OWNS — being a team
  // member on someone else's project (e.g. an employee) doesn't count
  // against this.
  const { count, error: countError } = await supabaseAdmin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if ((count || 0) >= 1) {
    return NextResponse.json(
      { error: "Your account already has a business connected. Each account supports one business." },
      { status: 403 }
    );
  }

  const body = await req.json();
  let { name, domain, logo_url } = body;

  // Name is no longer a hard gate — a brand-new account gets a project
  // auto-created (see dashboard/page.js) before it ever asks for one, so
  // there's no form to require it from at that point. Falls back to the
  // signup-time profile name; renamable anytime from the dashboard header.
  if (!name || !name.trim()) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    name = profile?.name ? `${profile.name}'s Business` : "My Business";
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      name: name.trim(),
      domain: domain || null,
      user_id: user.id,
      logo_url: logo_url || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}