// src/app/api/shop-offers/[offerId]/redemptions/route.js
import { NextResponse } from "next/server";
import { authedProxy, UUID_RE } from "../../../shop-branches/_proxy";

export async function GET(req, { params }) {
  const { offerId } = await params;
  if (!UUID_RE.test(offerId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 200) : 50;
  return authedProxy(req, `/shop/offers/${encodeURIComponent(offerId)}/redemptions?limit=${limit}`);
}
