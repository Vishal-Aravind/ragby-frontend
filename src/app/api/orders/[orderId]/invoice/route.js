// src/app/api/orders/[orderId]/invoice/route.js
// Dashboard invoice view. The backend checks shop-tab access on the order's project.
import { NextResponse } from "next/server";
import { authedProxy, UUID_RE } from "@/app/api/shop-branches/_proxy";

export async function GET(req, { params }) {
  const { orderId } = await params;
  if (!UUID_RE.test(orderId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return authedProxy(req, `/orders/${encodeURIComponent(orderId)}/invoice`);
}
