
// ─────────────────────────────────────────────────────────
// app/auth/callback/route.js
// Handles email verification redirect from Supabase
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
 
export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
 
  if (code) {
    const cookieStore = await cookies();
    const response = NextResponse.redirect(`${origin}${next}`);
 
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