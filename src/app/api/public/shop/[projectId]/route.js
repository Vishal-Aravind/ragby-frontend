// src/app/api/public/shop/[projectId]/route.js
//
// FIX: previously queried Supabase directly with the public anon key —
// harmless in isolation (it only ever selected safe columns / filtered to
// is_available), but that safety only held as long as this file stayed
// careful. Once shop_config/products got real RLS policies (scoped to
// project owner/members, since the dashboard genuinely needs direct
// read/write access to them), that direct anon-key path would either
// break (policy blocks it) or, if a future public policy were added
// instead, risk exposing shop_config.razorpay_key_secret to anyone (RLS
// is row-level, not column-level). backend/shop.py already has an
// equivalent, already-safe, service-role-backed version of this exact
// data (GET /public/shop/{project_id}/config and /products) — proxying
// to it removes the duplicate DB access path entirely instead of trying
// to keep two implementations of the same public read in sync.
import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_BASE_URL;

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "config" or "products"
  const catalog_id = searchParams.get("catalog_id");

  if (type === "config") {
    const res = await fetch(`${BACKEND}/public/shop/${projectId}/config`);
    if (!res.ok) return NextResponse.json({}, { status: 500 });
    return NextResponse.json(await res.json());
  }

  if (type === "products") {
    const url = new URL(`${BACKEND}/public/shop/${projectId}/products`);
    if (catalog_id) url.searchParams.set("catalog_id", catalog_id);
    const res = await fetch(url.toString());
    if (!res.ok) return NextResponse.json([], { status: 500 });
    return NextResponse.json(await res.json());
  }

  return NextResponse.json({ error: "type required" }, { status: 400 });
}
