// src/app/api/public/shop/[projectId]/orders/[orderId]/invoice/route.js
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

// Printable invoice. Auth is the per-order receipt or the customer token,
// both in the body; any failure is a uniform 404 from the backend.
export async function POST(req, { params }) {
  const { projectId, orderId } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { detail: { code: "invalid_request", message: "Invalid request." } },
      { status: 400 }
    );
  }
  return proxyToBackend(`/public/shop/${encodeURIComponent(projectId)}/orders/${encodeURIComponent(orderId)}/invoice`, {
    req,
    method: "POST",
    body,
  });
}
