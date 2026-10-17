// src/app/api/public/shop/submit-cart/route.js
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

// proxyToBackend keeps the backend's status code and its `detail` (a
// {code, message} object for shop errors), forwards the real visitor IP for
// the per-IP limit, and turns a non-JSON backend error (a traceback) into a
// generic message instead of showing it to an anonymous shopper.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { detail: { code: "invalid_request", message: "Invalid request." } },
      { status: 400 }
    );
  }
  return proxyToBackend("/public/shop/submit-cart", { req, method: "POST", body });
}
