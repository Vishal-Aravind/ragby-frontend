// src/app/api/shop-offers/[offerId]/route.js
import { NextResponse } from "next/server";
import { authedProxy, readJson, UUID_RE } from "../../shop-branches/_proxy";

export async function PUT(req, { params }) {
  const { offerId } = await params;
  if (!UUID_RE.test(offerId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { body, error } = await readJson(req);
  if (error) return error;
  return authedProxy(req, `/shop/offers/${encodeURIComponent(offerId)}`, { method: "PUT", body });
}

export async function DELETE(req, { params }) {
  const { offerId } = await params;
  if (!UUID_RE.test(offerId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return authedProxy(req, `/shop/offers/${encodeURIComponent(offerId)}`, { method: "DELETE" });
}
