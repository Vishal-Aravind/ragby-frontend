// src/app/api/templates/create/route.js — proxies to the backend's /templates/create
// with the signed-in user's token (the backend checks the Templates tab
// permission and admin role).
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function POST(req) {
  const response = NextResponse.next();
  const supabase = createServerClient(
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  return proxyToBackend("/templates/create", { token: session.access_token, method: "POST", body, timeoutMs: 60000 });
}
