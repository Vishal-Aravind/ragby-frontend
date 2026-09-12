// src/app/api/public/shop/order/[orderId]/route.js
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
  const { orderId } = await params;
  const phone = req.nextUrl.searchParams.get("phone") || "";

  const qs = phone ? `?${new URLSearchParams({ phone })}` : "";
  const res = await proxyToBackend(
    `/public/shop/order/${encodeURIComponent(orderId)}${qs}`,
    { req }
  );

  // An empty cart is the honest answer for "not yours" or "not found"; the
  // page's job here is only to pre-fill, never to reveal. So every failure
  // — including an unreachable backend — looks identical from outside.
  if (res.status !== 200) return NextResponse.json({ items: [] }, { status: 200 });
  return NextResponse.json(await res.json(), { status: 200 });
}
