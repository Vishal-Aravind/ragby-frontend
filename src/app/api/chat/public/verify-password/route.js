// ─────────────────────────────────────────────────────────
// app/api/chat/public/verify-password/route.js
// Proxies to the FastAPI backend, which does the actual check + attempt
// rate-limiting — moved there because Next.js API routes run serverless
// (Vercel), so an in-memory attempt counter here wouldn't reliably persist
// between requests the way it does on the backend's long-running process.
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

export async function POST(req) {
  const { projectId, password } = await req.json();
  const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const res = await fetch(`${BACKEND}/public/chat/verify-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": visitorIp },
    body: JSON.stringify({ projectId, password }),
  });

  const text = await res.text();
  try { return NextResponse.json(JSON.parse(text), { status: res.status }); }
  catch { return NextResponse.json({ error: text }, { status: res.status }); }
}

