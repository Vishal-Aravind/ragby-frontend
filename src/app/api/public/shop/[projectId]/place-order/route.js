// src/app/api/public/shop/[projectId]/place-order/route.js
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

// The page's only order-writing call. The customer token rides in the body
// (never a header or URL); `req` forwards the visitor IP for the per-IP
// limit, and the backend's {code, message, ...extra} detail passes through
// untouched (price_changed / coupon_invalid carry a fresh quote).
export async function POST(req, { params }) {
  const { projectId } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { detail: { code: "invalid_request", message: "Invalid request." } },
      { status: 400 }
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { detail: { code: "invalid_request", message: "Invalid request." } },
      { status: 400 }
    );
  }
  return proxyToBackend(`/public/shop/${encodeURIComponent(projectId)}/place-order`, {
    req,
    method: "POST",
    body,
  });
}
