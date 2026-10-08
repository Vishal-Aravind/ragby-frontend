// app/api/chat/public/poll/route.js
// The team's replies on a hosted-link chat that a person is handling.
// Same access model as /history: the visitor holds the unguessable chat id.
import { NextResponse } from "next/server";
import { visitorHeaders } from "@/lib/visitor-ip";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ status: "bot", messages: [] }); }
  const { sessionId, projectId, after } = body || {};
  if (!UUID_RE.test(sessionId || "") || !UUID_RE.test(projectId || "")) {
    return NextResponse.json({ status: "bot", messages: [] });
  }
  try {
    const res = await fetch(`${BACKEND}/public/chat/poll`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...visitorHeaders(req) },
      body: JSON.stringify({ sessionId, projectId, after: typeof after === "string" ? after : null }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NextResponse.json({ status: "human", messages: [], cursor: after || null });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ status: "human", messages: [], cursor: after || null });
  }
}
