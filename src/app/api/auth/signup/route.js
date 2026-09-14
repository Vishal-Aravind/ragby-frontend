// ─────────────────────────────────────────────────────────
// app/api/auth/signup/route.js
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { validatePassword } from "@/lib/password";

export async function POST(req) {
  // Was an unguarded await req.json(), so a malformed body was a 500.
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (name.length > 100) {
    return NextResponse.json({ error: "That name is too long." }, { status: 400 });
  }

  const pwError = validatePassword(password, { email, name });
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  // Checked first, before touching Supabase Auth at all — nothing here
  // previously stopped scripted mass fake-account creation.
  const limit = await checkAuthRateLimit(req, "signup", { identifier: email.toLowerCase() });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts — please wait and try again." },
      { status: 429 }
    );
  }

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      // Not actually used for the link the user clicks anymore — the
      // Supabase "Confirm signup" email template links straight to
      // /confirm?token_hash={{ .TokenHash }}, which only calls verifyOtp()
      // on an explicit button press (see src/app/confirm/page.js for why:
      // the old {{ .ConfirmationURL }} link let email security scanners
      // consume the one-time token on their own automatic GET, before the
      // real user ever clicked). Left set for any client library code path
      // that still reads it, and as the fallback if the template is ever
      // reverted to {{ .ConfirmationURL }}.
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    },
  });

  if (error) {
    // Supabase's own wording distinguishes "User already registered",
    // which turns this form into an email-existence oracle. Log the real
    // reason, return a uniform one.
    console.error("signup failed:", error.message);
    const message = /already registered|already exists/i.test(error.message || "")
      ? "If that email is available, check your inbox to confirm it."
      : "Could not create that account. Please check your details and try again.";
    const status = /already registered|already exists/i.test(error.message || "") ? 200 : 400;
    return NextResponse.json(
      status === 200 ? { success: true, needsVerification: true } : { error: message },
      { status }
    );
  }

  // Create profile using service role (bypasses RLS). There is no database
  // trigger doing this — this route is the only thing that creates the row,
  // and `plan` lives on it, so an account without one has no plan at all.
  if (data.user) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    // The result was never checked, so a failed write was silent and
    // signup still returned success.
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      name,
      email,
      plan: "free",
    }, { onConflict: "id" });

    if (profileError) {
      console.error("profile creation failed for", data.user.id, profileError);
      return NextResponse.json(
        { error: "Your account was created but setup did not finish. Please contact support." },
        { status: 500 }
      );
    }
  }

  // If email confirmation is required
  const needsVerification = !data.session;

  // Return the response carrying the session cookies. A fresh JSON object
  // was returned instead, so with confirmation disabled no cookie was ever
  // set and the signup page's redirect to the dashboard bounced back to
  // login.
  return NextResponse.json(
    { success: true, needsVerification },
    { headers: response.headers }
  );
}
