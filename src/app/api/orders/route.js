// src/app/api/orders/route.js
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

  // FIX: previously any logged-in user could list any project's orders by
  // passing an arbitrary project_id.
  const role = await getProjectRole(user.id, project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Optional branch filter (Shop > Orders branch selector). Ignored unless
  // it is a UUID; RLS + the project filter keep it inside this project.
  const branch_id = searchParams.get("branch_id");

  let query = supabase
    .from("orders")
    .select("*")
    .eq("project_id", project_id);
  if (branch_id && UUID_RE.test(branch_id)) query = query.eq("branch_id", branch_id);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) return dbError("orders", error);
  return NextResponse.json(data || []);
}
