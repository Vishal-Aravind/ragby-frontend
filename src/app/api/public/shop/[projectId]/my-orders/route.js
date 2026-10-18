// src/app/api/public/shop/[projectId]/my-orders/route.js
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

// This customer's orders, keyed only on the token phone server side.
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
  return proxyToBackend(`/public/shop/${encodeURIComponent(projectId)}/my-orders`, {
    req,
    method: "POST",
    body,
  });
}
