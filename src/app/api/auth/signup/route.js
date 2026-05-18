// ─────────────────────────────────────────────────────────
// app/api/auth/signup/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
 
export async function POST(req) {
  const { name, email, password } = await req.json();
 
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
 
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
 
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
 
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      // Redirect to /auth/callback after email verification
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
 
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
 
  // Create profile using service role (bypasses RLS)
  if (data.user) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      name,
      email,
      plan: "free",
    }, { onConflict: "id" });
  }
 
  // If email confirmation is required
  const needsVerification = !data.session;
 
  return NextResponse.json({
    success: true,
    needsVerification,
  });
}