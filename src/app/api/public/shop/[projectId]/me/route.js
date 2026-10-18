// src/app/api/public/shop/[projectId]/me/route.js
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

// Who does this customer token belong to? Token in the body only.
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
  return proxyToBackend(`/public/shop/${encodeURIComponent(projectId)}/me`, {
    req,
    method: "POST",
    body,
  });
}
