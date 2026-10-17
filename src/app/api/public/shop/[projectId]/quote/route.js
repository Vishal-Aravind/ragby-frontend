// src/app/api/public/shop/[projectId]/quote/route.js
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

// Live checkout quote. Business-rule failures come back as 200 with
// `errors[]`; 4xx `detail` objects pass through untouched.
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
  return proxyToBackend(`/public/shop/${encodeURIComponent(projectId)}/quote`, {
    req,
    method: "POST",
    body,
  });
}
