// ─────────────────────────────────────────────────────────
// app/api/chat/public/message/route.js
// Handles public chat messages — no auth required
// Uses /public/chat on FastAPI with sessionId for memory
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
 
export async function POST(req) {
  const { projectId, message, sessionId } = await req.json();
 
  const res = await fetch(`${process.env.BACKEND_BASE_URL}/public/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, message, sessionId }),
  });
 
  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }
 
  return NextResponse.json(await res.json());
}
 