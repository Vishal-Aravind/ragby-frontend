// app/api/slack/callback/route.js
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { BACKEND } from "@/lib/backend-proxy";

export async function GET(req) {
  const code = req.nextUrl.searchParams.get("code");
  // "state" is now a single-use nonce minted by /slack/auth-url, not the
  // raw project_id — the backend resolves it back to a real project_id.
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  // This is the OAuth return leg, so an unhandled throw here lands the user
  // on a Next.js error page mid-install. res.json() threw on any non-JSON
  // backend response (a 502 HTML page, most likely), and there was no
  // timeout at all.
  let data;
  try {
    const res = await fetch(`${BACKEND}/slack/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ code, state }),
      signal: AbortSignal.timeout(30000),
    });
    data = await res.json();
    if (!res.ok) data = null;
  } catch (e) {
    console.error("slack callback failed", e);
    data = null;
  }

  if (!data || !data.project_id) {
    return NextResponse.redirect(new URL("/dashboard?slack_error=1", req.url));
  }

  return NextResponse.redirect(new URL(`/dashboard/${data.project_id}`, req.url));
}