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

// Only the params the backend understands, URL-encoded; empty ones dropped.
function query(pairs) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(pairs)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const catalog_id = searchParams.get("catalog_id") || "";
  const id = encodeURIComponent(projectId);

  if (type === "config") {
    return forward(`/public/shop/${id}/config`, {}, req);
  }

  if (type === "products") {
    return forward(`/public/shop/${id}/products${query({ catalog_id })}`, [], req);
  }

  if (type === "catalogs") {
    return forward(`/public/shop/${id}/catalogs`, [], req);
  }

  if (type === "offers") {
    // Public offers strip: no identity, so a plain GET is fine here.
    const fulfilment = searchParams.get("fulfilment") || "";
    const ful = fulfilment === "pickup" || fulfilment === "delivery" ? fulfilment : "";
    return forward(`/public/shop/${id}/offers${query({ fulfilment: ful })}`, { offers: [] }, req);
  }

  if (type === "status") {
    return proxyToBackend(`/public/shop/${id}/status`, { req });
  }

  return NextResponse.json({ detail: "type required" }, { status: 400 });
}
