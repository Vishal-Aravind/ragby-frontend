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
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ messages: [] });
  }
  const { sessionId, projectId } = body;

  // projectId is required by the backend now. The channel restriction was
  // the only binding before, so a leaked public session id from any
  // project returned its transcript to whoever held it.
  if (!sessionId || !UUID_RE.test(sessionId) || !projectId || !UUID_RE.test(projectId)) {
    return NextResponse.json({ messages: [] });
  }

  try {
    const res = await fetch(
      `${BACKEND}/public/chat/history/${sessionId}?project_id=${encodeURIComponent(projectId)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return NextResponse.json({ messages: [] });
    return NextResponse.json(await res.json());
  } catch (e) {
    // History is a redraw convenience; never fail the page over it.
    console.error("public chat history failed:", e);
    return NextResponse.json({ messages: [] });
  }
}