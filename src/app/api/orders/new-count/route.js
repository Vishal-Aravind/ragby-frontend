// src/app/api/orders/new-count/route.js
//
// How many shop orders arrived after `since` - the number behind the red
// badge on the dashboard's Shop menu. Count only; no order data is returned.
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireProjectTab } from "@/lib/supabase-api";

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
  const projectId = searchParams.get("project_id");
  const sinceRaw = searchParams.get("since");
  if (!projectId || !UUID_RE.test(projectId)) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }
  // Only a real timestamp reaches the filter below.
  const sinceMs = Date.parse(sinceRaw || "");
  if (Number.isNaN(sinceMs)) return NextResponse.json({ error: "since required" }, { status: 400 });
  const since = new Date(sinceMs).toISOString();

  const gate = await requireProjectTab(user.id, projectId, { tab: "shop" });
  if (!gate.ok) return gate.response;

  // A cart nobody has paid for or placed yet (pending) and cancelled orders
  // are not "new orders". placed_at covers carts that were placed later.
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .not("status", "in", "(pending,cancelled)")
    .or(`placed_at.gt.${since},created_at.gt.${since}`);

  if (error) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: count || 0 });
}
