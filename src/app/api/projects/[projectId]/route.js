import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getProjectRole, getProjectAccess } from "@/lib/supabase-api";

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

  // Owner, admin, or agent can all view the project — role (and, for
  // agents, custom permissions) determines what the dashboard shows them,
  // not whether they can load it at all.
  const { role: myRole, permissions: myPermissions } = await getProjectAccess(user.id, projectId);
  if (!myRole) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, domain, user_id, logo_url, brand_color, chat_enabled, chat_password, allowed_domains")
    .eq("id", projectId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The settings UI prefills the password field from this, but only
  // owner/admin can open those settings or PATCH them — an agent had no
  // reason to receive the plaintext chat password and now doesn't.
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";
  const payload = { ...data };
  if (!isOwnerOrAdmin) delete payload.chat_password;

  return NextResponse.json({ ...payload, myRole, myPermissions });
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

  // Was `.update(body)` — every column on `projects` was writable by any
  // owner/admin. That included `suspended`, the abuse kill switch enforced
  // in run_chat, so a merchant shut off for abuse could simply PATCH it
  // back to false; and `user_id`, i.e. reassigning the project. Only the
  // fields this settings screen actually edits are accepted.
  const EDITABLE_FIELDS = [
    "name",
    "domain",
    "chat_enabled",
    "chat_password",
    "brand_color",
    "logo_url",
    "allowed_domains",
  ];

  const update = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Normalise the allowlist: bare hostnames, lowercased, no scheme or path.
  if ("allowed_domains" in update) {
    const raw = Array.isArray(update.allowed_domains) ? update.allowed_domains : [];
    update.allowed_domains = raw
      .map((d) => String(d).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
      .filter(Boolean)
      .slice(0, 50);
  }

  const { error } = await supabaseAdmin
    .from("projects")
    .update(update)
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