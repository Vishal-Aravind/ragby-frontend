// ─────────────────────────────────────────────────────────
// app/api/auth/reset/request/route.js
// Sends a password reset email.
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";

// Always the same body, whatever happened. Saying "no account with that
// email" would turn this into an email-existence oracle, and saying
// "email sent" only for real accounts leaks the same thing by timing of
// the wording rather than the response.
const UNIFORM = {
  success: true,
  message: "If an account exists for that email, a reset link is on its way.",
};

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    // A malformed address cannot belong to anyone, so this reveals nothing.
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Two buckets. Per IP stops a scripted sweep; per email stops this being
  // used to flood one person's inbox, which an IP-only limit never did
  // because the attacker simply rotates address.
  const limit = await checkAuthRateLimit(req, "password_reset", { identifier: email });
  if (!limit.allowed) {
    // Still uniform — a 429 here would confirm nothing about the account,
    // but telling the user to slow down is honest and not a leak.
    return NextResponse.json(
      { error: "Too many reset requests — please wait and try again." },
      { status: 429 }
    );
  }

  // Anon client: resetPasswordForEmail is a public operation and must not
  // run with the service role.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    });
    if (error) {
      // Never returned to the caller — the error text distinguishes a
      // missing account from a send failure. But it must not vanish
      // either: an exhausted SMTP quota looks exactly like success from
      // the browser, so without this the whole reset flow can be dead for
      // everyone and nothing anywhere says so.
      console.error("password reset request failed:", error.message);
      Sentry.captureMessage(`password reset email not sent: ${error.message}`, "warning");
    }
  } catch (e) {
    console.error("password reset request threw:", e);
    Sentry.captureException(e);
  }

  return NextResponse.json(UNIFORM);
}
