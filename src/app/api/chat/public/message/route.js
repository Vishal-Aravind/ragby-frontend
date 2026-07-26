// ─────────────────────────────────────────────────────────
// app/api/chat/public/message/route.js
// Handles public chat messages — no auth required
// Uses /public/chat on FastAPI with sessionId for memory
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
 
export async function POST(req) {
  const { projectId, message, sessionId } = await req.json();

  // This route just proxies straight to FastAPI, so without forwarding it
  // explicitly, the backend would only ever see Vercel's own outbound IP
  // for every visitor — making any per-visitor rate limiting there useless.
  const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const res = await fetch(`${process.env.BACKEND_BASE_URL}/public/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": visitorIp },
    body: JSON.stringify({ projectId, message, sessionId }),
  });
 
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }
 
  return NextResponse.json(await res.json());
}
 