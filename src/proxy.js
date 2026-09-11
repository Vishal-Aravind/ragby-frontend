// proxy.js
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function proxy(request) {
  let response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) =>
          response.cookies.set({ name, value, ...options }),
        remove: (name, options) =>
          response.cookies.set({ name, value: "", ...options }),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const authPages =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/verification");

  const protectedPages = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  // /reset-password establishes a recovery session, which makes the user
  // "logged in" — so without this it would be treated as an auth page and
  // bounced to the dashboard before they could set a new password.
  const recoveryPages = pathname.startsWith("/reset-password");

  if (user && authPages && !recoveryPages) {
    // An unverified user is sent to /verification below, and /verification
    // is itself an auth page — without this exception the two redirects
    // bounce off each other forever.
    const stuckOnVerification =
      !user.email_confirmed_at && pathname.startsWith("/verification");
    if (!stuckOnVerification) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (!user && protectedPages) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Email confirmation was enforced in exactly one place, the login route,
  // so any session obtained another way reached the dashboard and every
  // API unverified. Checked here so it covers every protected page rather
  // than one entry point.
  if (user && protectedPages && !user.email_confirmed_at) {
    return NextResponse.redirect(new URL("/verification", request.url));
  }

  // /admin needs staff status specifically, not just any login. Checked
  // with the service-role client, not the anon-key one above — staff_roles
  // has RLS enabled with zero policies (deliberately, from the RLS
  // lockdown), so the anon client can't read it regardless of who's
  // logged in. This is a server-side, pre-render redirect so a non-staff
  // account never even sees the admin page shell start loading — the
  // actual data was already independently protected (every /api/admin/*
  // route re-checks staff status itself), this just closes the same gap
  // one layer earlier.
  if (user && pathname.startsWith("/admin")) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: staff } = await supabaseAdmin
      .from("staff_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!staff) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
