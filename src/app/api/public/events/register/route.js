import { NextResponse } from "next/server";
import { visitorHeaders } from "@/lib/visitor-ip";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let res;
  try {
    res = await fetch(`${BACKEND}/public/events/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...visitorHeaders(req) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    console.error("registration backend unreachable:", e);
    return NextResponse.json(
      { detail: "We couldn't reach the registration service. Please try again in a moment." },
      { status: 502 }
    );
  }

  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    // 4xx bodies here are written for the person registering ("this event
    // is full", "you are already registered"), so they pass through.
    // Anything else did not come from our own validation.
    if (res.ok || res.status < 500) return NextResponse.json(parsed, { status: res.status });
    console.error("registration backend error:", res.status, text.slice(0, 500));
    return NextResponse.json({ detail: "Something went wrong. Please try again." }, { status: 500 });
  } catch {
    // Was `{ error: text }` — a backend 500 returns an HTML traceback, and
    // this put it straight in front of an anonymous visitor.
    console.error("registration backend returned non-JSON:", text.slice(0, 500));
    return NextResponse.json({ detail: "Something went wrong. Please try again." }, { status: 502 });
  }
}
