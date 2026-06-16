// src/app/api/public/shop/order/[orderId]/route.js
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    const { orderId } = await params;
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

    const res = await fetch(`${backendUrl}/public/shop/order/${orderId}`);
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("order fetch proxy error:", e);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}