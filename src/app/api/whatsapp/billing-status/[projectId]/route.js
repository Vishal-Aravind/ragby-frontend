// src/app/api/whatsapp/billing-status/[projectId]/route.js
// Whether the project's WhatsApp account can deliver paid (template)
// messages - i.e. has a payment method in Meta. Proxies to the backend.
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
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
  const { projectId } = await params;
  return proxyToBackend(`/whatsapp/billing-status/${projectId}`, { token: session.access_token });
}
