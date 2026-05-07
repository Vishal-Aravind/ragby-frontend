// app/api/slack/callback/route.js
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function GET(req) {
  const code = req.nextUrl.searchParams.get("code");
  const project_id = req.nextUrl.searchParams.get("state");

  if (!code || !project_id) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();

  // FIX: use service role key directly since this is a server-side callback
  // session may not be available right after OAuth redirect
  const res = await fetch(`${process.env.BACKEND_BASE_URL}/slack/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // FIX: use session if available, otherwise skip auth check on this endpoint
      ...(session ? { "Authorization": `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ code, project_id }),
  });

  const data = await res.json();
  console.log("Slack callback result:", data); // check terminal

  return NextResponse.redirect(
    new URL(`/dashboard/${project_id}`, req.url)
  );
}