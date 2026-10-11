// src/app/api/template-library/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://ragby-backend.onrender.com";

function getSupabase(req) {
  const response = NextResponse.next();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => response.cookies.set({ name, value, ...options }),
        remove: (name, options) => response.cookies.set({ name, value: "", ...options }),
      },
    }
  );
}

// The backend requires a signed-in user for the library; this route used to
// call it with no token, got a 401 and returned [] - an empty Templates page.
export async function GET(req) {
  const { data: { session } } = await getSupabase(req).auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await fetch(`${BACKEND}/template-library`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: "Could not load the template library." }, { status: res.status });
  return NextResponse.json(await res.json());
}
