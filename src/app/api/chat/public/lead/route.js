// ─────────────────────────────────────────────────────────
// app/api/chat/public/lead/route.js
// Lead capture for the shareable-link chat — no auth required.
// The embeddable widget calls the backend's /public/leads directly (it runs
// on the merchant's own site), but this page proxies, because
// BACKEND_BASE_URL is server-only here.
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { BACKEND } from "@/lib/backend-proxy";
import { visitorHeaders } from "@/lib/visitor-ip";

export async function POST(req) {
  const { projectId, sessionId, chatSessionId, name, email, phone } = await req.json();

  let res;
  try {
    // BACKEND_BASE_URL alone was resolved here; every other route resolves
    // the full chain, so one missing name meant "undefined/public/leads".
    res = await fetch(`${BACKEND}/public/leads`, {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: { "Content-Type": "application/json", ...visitorHeaders(req) },
      body: JSON.stringify({
        project_id: projectId,
        session_id: sessionId,
        chat_session_id: chatSessionId,
        name,
        email,
        phone,
      }),
    });
  } catch (err) {
    // Render's free tier sleeps, so an unreachable backend is routine.
    console.error("public lead submit failed:", err);
    return NextResponse.json(
      { error: "Couldn't save your details. Please try again." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const raw = await res.text();
    console.error("public lead rejected:", res.status, raw);

    // Every 400 from /public/leads is written for an end user ("Please enter
    // a valid email address"), so those are worth showing. Anything else
    // could be an unhandled Python error, which must not reach a visitor.
    let error = "Couldn't save your details. Please try again.";
    if (res.status === 400) {
      try {
        const detail = JSON.parse(raw).detail;
        if (typeof detail === "string" && detail) error = detail;
      } catch {}
    } else if (res.status === 429) {
      error = "Too many attempts — please wait a moment and try again.";
    }
    return NextResponse.json({ error }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
