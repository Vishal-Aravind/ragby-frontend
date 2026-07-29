// src/app/api/public/shop/submit-cart/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    if (!backendUrl) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
    }

    const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const res = await fetch(`${backendUrl}/public/shop/submit-cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": visitorIp },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("Backend non-JSON response:", text);
      return NextResponse.json({ error: text || "Backend error" }, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("submit-cart proxy error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}