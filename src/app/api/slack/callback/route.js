// app/api/slack/callback/route.js
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function GET(req) {
  const code = req.nextUrl.searchParams.get("code");
  const project_id = req.nextUrl.searchParams.get("state");

  console.log("Slack callback hit:", { code: !!code, project_id });
  console.log("BACKEND_BASE_URL:", process.env.BACKEND_BASE_URL);

  if (!code || !project_id) {
    console.log("Missing code or project_id");
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  console.log("Session exists:", !!session);

  const res = await fetch(`${process.env.BACKEND_BASE_URL}/slack/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { "Authorization": `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ code, project_id }),
  });

  const data = await res.json();
  console.log("Backend response:", data);

  return NextResponse.redirect(new URL(`/dashboard/${project_id}`, req.url));
}