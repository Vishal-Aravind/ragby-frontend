// src/app/api/public/shop/[projectId]/route.js
import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

// Both branches used to swallow every failure into {} or [] with a 500, so
// the shop page couldn't tell "this shop is switched off" (now a real 403
// from the backend) from "something broke". It renders an empty menu either
// way, which reads to a customer as a store with nothing for sale.
//
// proxyToBackend now supplies the timeout, the non-JSON guard and the real
// visitor IP; this wrapper only keeps the empty-value fallback.
async function forward(path, emptyValue, req) {
  const res = await proxyToBackend(path, { req });
  if (res.status !== 200) return res;
  const data = await res.json();
  return NextResponse.json(data ?? emptyValue);
}

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const catalog_id = searchParams.get("catalog_id");
  const id = encodeURIComponent(projectId);

  if (type === "config") {
    return forward(`/public/shop/${id}/config`, {}, req);
  }

  if (type === "products") {
    const qs = catalog_id
      ? `?${new URLSearchParams({ catalog_id })}`
      : "";
    return forward(`/public/shop/${id}/products${qs}`, [], req);
  }

  if (type === "catalogs") {
    return forward(`/public/shop/${id}/catalogs`, [], req);
  }

  return NextResponse.json({ detail: "type required" }, { status: 400 });
}
