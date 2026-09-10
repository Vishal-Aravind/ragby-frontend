import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId } = await params;

  // Tab enforcement lives in the backend, which resolves the event's
  // project first. This route's own bug was returning the raw backend body
  // on failure — registrant names, phones and emails are behind it.
  return proxyToBackend(`/events/${encodeURIComponent(eventId)}/registrations`, {
    token: session.access_token,
  });
}
