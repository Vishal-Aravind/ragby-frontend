import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req) {
  // The response has to exist BEFORE the client is built, because the
  // cookie deletions below are written onto it.
  //
  // This used to create a NextResponse.next() here, let Supabase write the
  // deletions onto that, and then return a completely different
  // NextResponse.json — so the browser was never told to clear anything
  // and the session cookie survived "Sign out". signOut() does revoke the
  // refresh token, so the session could not be renewed, but the unexpired
  // access token and the cookie both stayed put: on a shared computer the
  // next person was still signed in.
  //
  // NextResponse.next() is also not valid in a route handler; it belongs
  // in the proxy.
  const response = NextResponse.json({ success: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) =>
          response.cookies.set({ name, value, ...options }),
        remove: (name, options) =>
          response.cookies.set({ name, value: "", ...options, maxAge: 0 }),
      },
    }
  );

  try {
    await supabase.auth.signOut();
  } catch (e) {
    // Even if Supabase is unreachable, still clear the cookies below —
    // a failed sign-out must never leave the user looking signed in.
    console.error("signOut failed, clearing cookies anyway:", e);
  }

  // Belt and braces: clear the auth cookies by name too. Supabase's
  // remove() only fires for cookies it currently knows about, and a
  // partially-written cookie set would otherwise survive.
  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set({ name: cookie.name, value: "", path: "/", maxAge: 0 });
    }
  }

  return response;
}
