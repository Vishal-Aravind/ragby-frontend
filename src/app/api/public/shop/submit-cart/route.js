// src/app/api/public/shop/submit-cart/route.js
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();

    // Use server-side env var (without NEXT_PUBLIC_ prefix)
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    if (!backendUrl) {
      console.error("BACKEND_URL not set");
      return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
    }

    const res = await fetch(`${backendUrl}/public/shop/submit-cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("submit-cart proxy error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}