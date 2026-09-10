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
    res = await fetch(`${BACKEND}/public/appointments/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...visitorHeaders(req) },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("booking backend unreachable:", e);
    return NextResponse.json(
      { error: "We couldn't reach the booking service. Please try again in a moment." },
      { status: 502 }
    );
  }

  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    // 4xx bodies here are written for the person booking ("that slot is no
    // longer available"), so they pass through. Anything else did not come
    // from our own validation and must not be shown.
    if (res.ok || res.status < 500) return NextResponse.json(parsed, { status: res.status });
    console.error("booking backend error:", res.status, text.slice(0, 500));
    return NextResponse.json({ error: "Something went wrong booking that slot." }, { status: 500 });
  } catch {
    // Was `{ error: text }` — a backend 500 returns an HTML traceback, and
    // this put it straight in front of an anonymous visitor.
    console.error("booking backend returned non-JSON:", text.slice(0, 500));
    return NextResponse.json({ error: "Something went wrong booking that slot." }, { status: 502 });
  }
}
