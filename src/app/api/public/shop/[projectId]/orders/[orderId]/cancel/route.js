// src/app/api/public/shop/[projectId]/orders/[orderId]/cancel/route.js
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

// Customer cancel of an unpaid order (receipt or token in the body).
export async function POST(req, { params }) {
  const { projectId, orderId } = await params;
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
  return proxyToBackend(`/public/shop/${encodeURIComponent(projectId)}/orders/${encodeURIComponent(orderId)}/cancel`, {
    req,
    method: "POST",
    body,
  });
}
