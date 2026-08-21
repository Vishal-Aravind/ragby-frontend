import { NextResponse } from "next/server";

// FIX: this route used to query chat_messages directly with the SERVICE
// ROLE key (full RLS bypass) from a public, unauthenticated, internet-
// facing route, with no validation on sessionId at all. The backend
// already has an equivalent, already-reasoned-about endpoint for this
// exact job (GET /public/chat/history/{session_id}, see backend/chat.py —
// its own docstring documents session_id as the deliberate security
// model here: an unguessable UUID held client-side, the same trust model
// widget.js's version of this already uses) — proxy to that instead of
// duplicating raw service-role DB access in a second, less-controlled
// place. Not a behavior change, just removes an unnecessary second
// exposure of the service-role key.
const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req) {
  const { sessionId } = await req.json();
  if (!sessionId || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ messages: [] });
  }

  const res = await fetch(`${BACKEND}/public/chat/history/${sessionId}`);
  if (!res.ok) return NextResponse.json({ messages: [] });
  return NextResponse.json(await res.json());
}