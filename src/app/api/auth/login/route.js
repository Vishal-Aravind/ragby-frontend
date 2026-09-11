// ─────────────────────────────────────────────────────────
// app/api/auth/login/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";

export async function POST(req) {
  // Was an unguarded await req.json(), so a malformed body was a 500.
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Two buckets. The IP one caps a single attacker; the email one caps
  // attempts against a single account from many addresses, which the
  // IP-only key never did.
  const limit = await checkAuthRateLimit(req, "login", { identifier: email.toLowerCase() });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts — please wait and try again." },
      { status: 429 }
    );
  }

  // Must return the response object the cookies get written to.
  const response = NextResponse.json({ success: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => response.cookies.set({ name, value, ...options }),
        remove: (name, options) => response.cookies.set({ name, value: "", ...options, maxAge: 0 }),
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase answers "Invalid login credentials" for both a wrong email
    // and a wrong password, so this is not an enumeration oracle. Kept as
    // a fixed string rather than passing error.message through, so that
    // stays true if Supabase ever changes its wording.
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (!data.user?.email_confirmed_at) {
    // signInWithPassword has already created a session at Supabase by this
    // point. Returning a different response means its cookies are never
    // sent, so the browser holds nothing.
    return NextResponse.json(
      { error: "Please verify your email before logging in. Check your inbox." },
      { status: 403 }
    );
  }

  return response;
}
