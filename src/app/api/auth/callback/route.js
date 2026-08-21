
// ─────────────────────────────────────────────────────────
// app/auth/callback/route.js
// Handles email verification redirect from Supabase
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
 
// FIX: `next` was previously concatenated straight into the redirect
// target (`${origin}${next}`) with no validation — a value like
// "@evil.com" produces "https://app.zavo...@evil.com", which per the
// WHATWG URL spec parses as valid userinfo+host, silently redirecting off
// this origin after a real login. Only ever allow a same-origin path.
function safeNextPath(next) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("://") || next.includes("\\")) {
    return "/dashboard";
  }
  return next;
}

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next") ?? "/dashboard");

  if (code) {
    const cookieStore = await cookies();
    const response = NextResponse.redirect(new URL(next, origin));
 
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name) => cookieStore.get(name)?.value,
          set: (name, value, options) => response.cookies.set({ name, value, ...options }),
          remove: (name, options) => response.cookies.set({ name, value: "", ...options }),
        },
      }
    );
 
    const { error } = await supabase.auth.exchangeCodeForSession(code);
 
    if (!error) {
      return response;
    }
  }
 
  // If error or no code — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=verification_failed`);
}