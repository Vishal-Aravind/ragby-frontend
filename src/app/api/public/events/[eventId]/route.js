import { NextResponse } from "next/server";
import { visitorHeaders } from "@/lib/visitor-ip";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

export async function GET(req, { params }) {
  const { eventId } = await params;

  let res;
  try {
    res = await fetch(`${BACKEND}/public/events/${encodeURIComponent(eventId)}`, {
      headers: { ...visitorHeaders(req) },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    console.error("event lookup backend unreachable:", e);
    return NextResponse.json(
      { detail: "We couldn't load this event. Please try again in a moment." },
      { status: 502 }
    );
  }

  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    if (res.ok || res.status < 500) return NextResponse.json(parsed, { status: res.status });
    console.error("event lookup backend error:", res.status, text.slice(0, 500));
    return NextResponse.json({ detail: "Something went wrong." }, { status: 500 });
  } catch {
    // Was `{ error: text }`, which forwarded a raw traceback to a visitor.
    console.error("event lookup returned non-JSON:", text.slice(0, 500));
    return NextResponse.json({ detail: "Something went wrong." }, { status: 502 });
  }
}
