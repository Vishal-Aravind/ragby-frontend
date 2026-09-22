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

  // Clicking the emailed link establishes a REAL session, not a limited
  // "you may change your password" token — so any path that leaves this
  // route without clearing it leaves the visitor silently logged in
  // having never entered a password. That is how a failed reset ended up
  // dropping the user straight into the dashboard.
  const clearSession = async (payload, status) => {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (e) {
      console.error("reset signOut failed:", e);
    }
    const out = NextResponse.json(payload, { status });
    for (const cookie of req.cookies.getAll()) {
      if (cookie.name.startsWith("sb-")) {
        out.cookies.set({ name: cookie.name, value: "", path: "/", maxAge: 0 });
      }
    }
    return out;
  };

  // The recovery link puts a real session in the cookie jar before this is
  // called. getUser re-validates it against the Auth server rather than
  // trusting the cookie, so an expired or already-used link fails here.
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    // One message for expired, already used, and never valid. Which of
    // those it was is not something the caller needs, and distinguishing
    // them tells an attacker whether a token ever existed.
    return clearSession(
      {
        error: "That reset link is invalid or has expired. Please request a new one.",
        sessionCleared: true,
      },
      401
    );
  }

  const pwError = validatePassword(password, { email: user.email });
  if (pwError) {
    // Not a spent link — the token is still good, so let them correct the
    // password rather than forcing a whole new reset email.
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("password update failed for", user.id, error.message);
    // Supabase rejects reusing the current password. That is worth saying
    // out loud — the generic wording sent people off to request another
    // link when the fix was simply to pick a different password.
    if (/different from the old password|should be different/i.test(error.message || "")) {
      return NextResponse.json(
        { error: "Your new password must be different from your current one." },
        { status: 400 }
      );
    }
    return clearSession(
      {
        error: "Could not update your password. Please request a new reset link.",
        sessionCleared: true,
      },
      400
    );
  }

  // Signing out globally also pushes every other device to re-authenticate
  // with the new password.
  return clearSession({ success: true }, 200);
}
