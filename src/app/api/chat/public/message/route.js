// ─────────────────────────────────────────────────────────
// app/api/chat/public/message/route.js
// Handles public chat messages — no auth required
// Uses /public/chat on FastAPI with sessionId for memory
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
 
export async function POST(req) {
  const { projectId, message, sessionId, accessToken, visitorId } = await req.json();

  // Note: forwarding X-Forwarded-For here does nothing useful. Render
  // APPENDS to that header and the backend deliberately trusts only the
  // rightmost hop (anything else is client-spoofable), which on this path
  // is Vercel's own egress IP. The backend therefore rate-limits this
  // surface per session as well as per IP — see public_chat.
  const res = await fetch(`${process.env.BACKEND_BASE_URL}/public/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, message, sessionId, accessToken, visitorId }),
  });

  if (!res.ok) {
    // Was forwarding the backend body verbatim, which for an unhandled
    // exception is a raw Python error string (table names, connection
    // details) shown to an anonymous visitor.
    const err = await res.text();
    console.error("public chat failed:", res.status, err);

    let error = "Sorry, something went wrong. Please try again.";
    if (res.status === 401) error = "This chat is password protected.";
    else if (res.status === 403) error = "This chat is not available.";
    else if (res.status === 429) error = "Too many messages right now. Please wait a moment.";
    return NextResponse.json({ error }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
 