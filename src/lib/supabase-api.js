// lib/supabase-api.js

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export function getSupabase(req) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) =>
          res.cookies.set({ name, value, ...options }),
        remove: (name, options) =>
          res.cookies.set({ name, value: "", ...options }),
      },
    }
  );

  return { supabase, res };
}

// FIX: Separate helper that returns the access token from the session.
// Call this in API routes that need to forward the JWT to FastAPI.
export async function getToken(supabase) {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}