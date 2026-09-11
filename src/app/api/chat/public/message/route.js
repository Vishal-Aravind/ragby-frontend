// ─────────────────────────────────────────────────────────
// app/api/chat/public/message/route.js
// Handles public chat messages — no auth required
// Uses /public/chat on FastAPI with sessionId for memory
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { visitorHeaders } from "@/lib/visitor-ip";

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_BASE_URL;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { projectId, message, sessionId, accessToken, visitorId } = body;

  // The old note here said forwarding the visitor IP was useless, because
  // the backend trusts only the rightmost forwarded hop and that is this
  // server's own egress address. That was true until the shared-secret
  // header landed: visitorHeaders now sends the real visitor IP with a
  // secret the backend verifies, so the per-IP limiter finally applies to
  // this surface instead of bucketing every visitor of every project
  // together. sessionId is client-minted and cannot carry that weight.
  // 60s: a chat turn can chain several OpenAI calls. Wrapped because the
  // timeout throws rather than returning a response, and an unhandled
  // throw here is a 500 in front of an anonymous visitor.
  let res;
  try {
    res = await fetch(`${BACKEND}/public/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...visitorHeaders(req) },
      body: JSON.stringify({ projectId, message, sessionId, accessToken, visitorId }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (e) {
    console.error("public chat unreachable:", e);
    return NextResponse.json(
      { error: "Sorry, we couldn't reach the assistant. Please try again." },
      { status: 502 }
    );
  }

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
 