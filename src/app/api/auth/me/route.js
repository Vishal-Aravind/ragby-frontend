import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req) {
  // Same shape as logout: the response must exist before the client, or
  // the refreshed session cookies Supabase writes here are discarded.
  // This returned a different response than the one they were written to.
  const response = NextResponse.json({ user: null });

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

  const { data: { user } } = await supabase.auth.getUser();

  // Only the fields the callers actually render. The whole Supabase user
  // object was returned, including app_metadata and the full identity
  // list, to Navbar, the account page and the Conversations tab.
  //
  // The exact set, checked against every consumer: Navbar reads email,
  // ConversationsTab reads id, and the account page reads email plus
  // created_at for its "Member since" line.
  const safeUser = user
    ? {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        name: user.user_metadata?.name || null,
        email_confirmed_at: user.email_confirmed_at || null,
      }
    : null;

  return NextResponse.json({ user: safeUser }, { headers: response.headers });
}
