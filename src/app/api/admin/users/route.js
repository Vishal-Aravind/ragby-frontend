// app/api/admin/users/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "khavinprakash03@gmail.com";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  // Verify the requesting user is admin
  const authHeader = req.headers.get("cookie") || "";

  // Use service role to get session from auth header
  const { createServerClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const month = new Date().toISOString().slice(0, 7); // "2026-05"

  // Get all profiles
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, name, email, plan, razorpay_customer_id, created_at")
    .order("created_at", { ascending: false });

  if (!profiles) return NextResponse.json([]);

  // Get usage for this month
  const { data: usageData } = await supabaseAdmin
    .from("usage")
    .select("user_id, count")
    .eq("month", month);

  const usageMap = {};
  (usageData || []).forEach(u => { usageMap[u.user_id] = u.count; });

  // Get project counts
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("user_id");

  const projectMap = {};
  (projects || []).forEach(p => {
    projectMap[p.user_id] = (projectMap[p.user_id] || 0) + 1;
  });

  // Merge everything
  const users = profiles.map(p => ({
    ...p,
    usage: usageMap[p.id] || 0,
    project_count: projectMap[p.id] || 0,
  }));

  return NextResponse.json(users);
}