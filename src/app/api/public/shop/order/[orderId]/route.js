// src/app/api/public/shop/order/[orderId]/route.js
import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

export async function GET(req, { params }) {
  const { orderId } = await params;
  const phone = req.nextUrl.searchParams.get("phone") || "";

  try {
    const url = new URL(`${BACKEND}/public/shop/order/${encodeURIComponent(orderId)}`);
    if (phone) url.searchParams.set("phone", phone);

    const res = await fetch(url.toString());
    const text = await res.text();

    try {
      const data = JSON.parse(text);
      // An empty cart is the honest answer for "not yours" or "not found";
      // the page's job here is only to pre-fill, never to reveal.
      return NextResponse.json(res.ok ? data : { items: [] }, { status: 200 });
    } catch {
      console.error("order fetch returned non-JSON:", res.status, text.slice(0, 300));
      return NextResponse.json({ items: [] }, { status: 200 });
    }
  } catch (e) {
    console.error("order fetch proxy error:", e);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
