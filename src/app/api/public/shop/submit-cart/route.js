// src/app/api/public/shop/submit-cart/route.js
import { NextResponse } from "next/server";
import { visitorHeaders } from "@/lib/visitor-ip";

export async function POST(req) {
  try {
    const body = await req.json();
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    if (!backendUrl) {
      return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
    }

    const res = await fetch(`${backendUrl}/public/shop/submit-cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...visitorHeaders(req) },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Was returning the raw body — on a backend 500 that put a Python
      // traceback in front of an anonymous shopper.
      console.error("submit-cart non-JSON response:", res.status, text.slice(0, 300));
      return NextResponse.json({ error: "Could not place that order. Please try again." }, { status: 502 });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("submit-cart proxy error:", e.message);
    return NextResponse.json({ error: "Could not reach the store. Please try again." }, { status: 502 });
  }
}