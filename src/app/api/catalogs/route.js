// src/app/api/catalogs/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getProjectRole } from "@/lib/supabase-api";
import { dbError } from "@/lib/api-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSupabase(req) {
  const response = NextResponse.next();
  return {
    supabase: createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name) => req.cookies.get(name)?.value,
          set: (name, value, options) => response.cookies.set({ name, value, ...options }),
          remove: (name, options) => response.cookies.set({ name, value: "", ...options }),
        },
      }
    ),
  };
}

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const role = await getProjectRole(user.id, project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Optional branch filter (Shop > Menu is per branch). Without it every
  // catalog in the project is returned, as before (Flows uses that).
  const branch_id = searchParams.get("branch_id");

  let query = supabase
    .from("catalogs")
    .select("*")
    .eq("project_id", project_id);
  if (branch_id && UUID_RE.test(branch_id)) query = query.eq("branch_id", branch_id);

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) return dbError("catalogs", error);
  return NextResponse.json(data || []);
}

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const role = await getProjectRole(user.id, body.project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // branch_id: the composite FK (branch_id, project_id) rejects another
  // project's branch; when omitted, the DB trigger assigns the default one.
  if (body.branch_id != null && !UUID_RE.test(String(body.branch_id))) {
    return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("catalogs")
    .insert({
      project_id: body.project_id,
      name: body.name,
      description: body.description || null,
      is_active: body.is_active ?? true,
      ...(body.branch_id ? { branch_id: body.branch_id } : {}),
    })
    .select()
    .single();

  if (error) return dbError("catalogs", error);
  return NextResponse.json(data);
}
