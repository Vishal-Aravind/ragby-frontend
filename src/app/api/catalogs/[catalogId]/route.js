// src/app/api/catalogs/[catalogId]/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getProjectRole } from "@/lib/supabase-api";

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

export async function PUT(req, { params }) {
  const { catalogId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existingCatalog } = await supabase
    .from("catalogs")
    .select("project_id")
    .eq("id", catalogId)
    .maybeSingle();
  if (!existingCatalog) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await getProjectRole(user.id, existingCatalog.project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const update = {};
  if ("name" in body) update.name = body.name;
  if ("description" in body) update.description = body.description;
  if ("is_active" in body) update.is_active = body.is_active;

  const { data, error } = await supabase
    .from("catalogs")
    .update(update)
    .eq("id", catalogId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req, { params }) {
  const { catalogId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existingCatalog } = await supabase
    .from("catalogs")
    .select("project_id")
    .eq("id", catalogId)
    .maybeSingle();
  if (!existingCatalog) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await getProjectRole(user.id, existingCatalog.project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabase.from("products").delete().eq("catalog_id", catalogId);
  await supabase.from("catalogs").delete().eq("id", catalogId);
  return NextResponse.json({ status: "deleted" });
}
