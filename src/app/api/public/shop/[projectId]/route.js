// src/app/api/public/shop/[projectId]/route.js
import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

// Both branches used to swallow every failure into {} or [] with a 500, so
// the shop page couldn't tell "this shop is switched off" (now a real 403
// from the backend) from "something broke". It renders an empty menu either
// way, which reads to a customer as a store with nothing for sale.
async function forward(url, emptyValue) {
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    console.error("shop fetch failed:", e);
    return NextResponse.json({ error: "Could not reach the store." }, { status: 502 });
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("shop backend returned non-JSON:", res.status, text.slice(0, 300));
    return NextResponse.json({ error: "Could not load the store." }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: data.detail || "Could not load the store." },
      { status: res.status }
    );
  }
  return NextResponse.json(data ?? emptyValue);
}

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const catalog_id = searchParams.get("catalog_id");

  if (type === "config") {
    return forward(`${BACKEND}/public/shop/${projectId}/config`, {});
  }

  if (type === "products") {
    const url = new URL(`${BACKEND}/public/shop/${projectId}/products`);
    if (catalog_id) url.searchParams.set("catalog_id", catalog_id);
    return forward(url.toString(), []);
  }

  if (type === "catalogs") {
    return forward(`${BACKEND}/public/shop/${projectId}/catalogs`, []);
  }

  return NextResponse.json({ error: "type required" }, { status: 400 });
}
