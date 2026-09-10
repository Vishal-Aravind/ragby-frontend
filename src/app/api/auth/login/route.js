
// ─────────────────────────────────────────────────────────
// app/api/auth/login/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { visitorHeaders } from "@/lib/visitor-ip";
 
const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

export async function POST(req) {
  const { email, password } = await req.json();

  // Checked first, before touching Supabase Auth at all — nothing here
  // previously stopped scripted credential-stuffing against this route.
  const rateCheck = await fetch(`${BACKEND}/auth/rate-limit-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...visitorHeaders(req) },
    body: JSON.stringify({ action: "login" }),
  });
  if (!rateCheck.ok) {
    return NextResponse.json({ error: "Too many login attempts — please wait and try again." }, { status: 429 });
  }

  // Must return a response object to set cookies on
  const response = NextResponse.json({ success: true });
 
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => response.cookies.set({ name, value, ...options }),
        remove: (name, options) => response.cookies.set({ name, value: "", ...options }),
      },
    }
  );
 
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
 
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
 
  // Check email is confirmed
  if (!data.user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Please verify your email before logging in. Check your inbox." },
      { status: 401 }
    );
  }
 
  return response;
}
 
 