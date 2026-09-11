// ─────────────────────────────────────────────────────────
// app/api/auth/reset/confirm/route.js
// Sets a new password using the recovery session from the emailed link.
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { validatePassword } from "@/lib/password";

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const password = typeof body?.password === "string" ? body.password : "";

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

  // The recovery link puts a real session in the cookie jar before this is
  // called. getUser re-validates it against the Auth server rather than
  // trusting the cookie, so an expired or already-used link fails here.
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    // One message for expired, already used, and never valid. Which of
    // those it was is not something the caller needs, and distinguishing
    // them tells an attacker whether a token ever existed.
    return NextResponse.json(
      { error: "That reset link is invalid or has expired. Please request a new one." },
      { status: 401 }
    );
  }

  const pwError = validatePassword(password, { email: user.email });
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("password update failed for", user.id, error.message);
    return NextResponse.json(
      { error: "Could not update your password. Please request a new reset link." },
      { status: 400 }
    );
  }

  // Sign the recovery session out so the emailed link cannot be reused as
  // a live session, and so every other device is pushed to re-authenticate
  // with the new password. Without this, whoever triggered the reset keeps
  // a working session on the account.
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch (e) {
    console.error("post-reset signOut failed:", e);
  }

  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set({ name: cookie.name, value: "", path: "/", maxAge: 0 });
    }
  }

  return response;
}
