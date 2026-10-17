// src/app/api/orders/[orderId]/route.js
//
// Order status / payment status changes go through the backend now: it
// enforces the status vocabulary and transitions (closed orders stay
// closed, no "out for delivery" on a pickup order) and sends the customer
// a WhatsApp update when `notify` is true. The old direct Supabase write
// skipped all of that. The dashboard never edited special_request, so that
// field is no longer accepted here.
import { NextResponse } from "next/server";
import { authedProxy, readJson, UUID_RE } from "@/app/api/shop-branches/_proxy";

export async function PUT(req, { params }) {
  const { orderId } = await params;
  if (!UUID_RE.test(orderId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { body, error } = await readJson(req);
  if (error) return error;

  const payload = {};
  if (body && "status" in body) payload.status = body.status;
  if (body && "payment_status" in body) payload.payment_status = body.payment_status;
  if (body && "notify" in body) payload.notify = body.notify !== false;

  return authedProxy(req, `/orders/${encodeURIComponent(orderId)}`, { method: "PUT", body: payload });
}
