import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

// These two address an event by id, not a project, so the tab check has to
// happen where the event's project is known — the backend resolves it in
// _require_role_for_event and enforces tab="events" with min_role="admin".
// What was missing here was propagating the answer: the route used to
// return the raw backend body on any failure, including a 500's traceback.
export async function PUT(req, { params }) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  return proxyToBackend(`/events/${encodeURIComponent(eventId)}`, {
    token: session.access_token,
    method: "PUT",
    body,
  });
}

export async function DELETE(req, { params }) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId } = await params;

  return proxyToBackend(`/events/${encodeURIComponent(eventId)}`, {
    token: session.access_token,
    method: "DELETE",
  });
}
