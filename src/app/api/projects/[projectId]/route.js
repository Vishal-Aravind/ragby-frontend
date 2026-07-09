import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getProjectRole } from "@/lib/supabase-api";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getSupabase(req, response) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
}

// ---------------- GET ----------------
export async function GET(req, { params }) {
  const { projectId } = await params;
  const response = NextResponse.next();

  const supabase = getSupabase(req, response);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Owner, admin, or agent can all view the project — role determines
  // what the dashboard shows them, not whether they can load it at all.
  const myRole = await getProjectRole(user.id, projectId);
  if (!myRole) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, domain, user_id, logo_url, brand_color, chat_enabled, chat_password")
    .eq("id", projectId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ...data, myRole });
}

// ---------------- PATCH ----------------
export async function PATCH(req, { params }) {
  const { projectId } = await params;
  const response = NextResponse.next();

  const supabase = getSupabase(req, response);

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Settings (domain, chat widget config, branding) are owner/admin only —
  // agents shouldn't be able to change project configuration.
  const myRole = await getProjectRole(user.id, projectId);
  if (myRole !== "owner" && myRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const { error } = await supabaseAdmin
    .from("projects")
    .update(body)
    .eq("id", projectId);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req, { params }) {
  const { projectId } = await params;
  const response = NextResponse.next();
  const supabase = getSupabase(req, response);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Deleting the whole project is owner-only — admins/agents manage it,
  // they don't get to destroy it.
  const myRole = await getProjectRole(user.id, projectId);
  if (myRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) return NextResponse.json({ error: "Delete failed" }, { status: 500 });

  return NextResponse.json({ success: true });
}