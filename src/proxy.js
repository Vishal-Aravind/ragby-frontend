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
    pathname.startsWith("/verification");

  const protectedPages = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (user && authPages) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!user && protectedPages) {
    return NextResponse.redirect(new URL("/login", request.url));
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
