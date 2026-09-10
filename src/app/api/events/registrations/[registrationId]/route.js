import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function PUT(req, { params }) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { registrationId } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  return proxyToBackend(`/events/registrations/${encodeURIComponent(registrationId)}`, {
    token: session.access_token,
    method: "PUT",
    body,
  });
}
