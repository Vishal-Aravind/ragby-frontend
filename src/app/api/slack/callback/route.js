
// ─────────────────────────────────────────────────────────
// app/api/slack/callback/route.js
// Handles OAuth redirect from Slack, exchanges code for token
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
 
export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
 
  const code = req.nextUrl.searchParams.get("code");
  const project_id = req.nextUrl.searchParams.get("state"); // we pass projectId as state
 
  if (!code || !project_id) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
 
  if (session) {
    // Exchange code via backend
    await fetch(`${process.env.BACKEND_BASE_URL}/slack/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ code, project_id }),
    });
  }
 
  // Redirect back to project integrations tab
  return NextResponse.redirect(
    new URL(`/dashboard/${project_id}?tab=integrations`, req.url)
  );
}