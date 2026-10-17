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
  const branch_id = searchParams.get("branch_id") || "";
  const id = encodeURIComponent(projectId);

  if (type === "config") {
    return forward(`/public/shop/${id}/config`, {}, req);
  }

  if (type === "products") {
    return forward(`/public/shop/${id}/products${query({ branch_id, catalog_id })}`, [], req);
  }

  if (type === "catalogs") {
    return forward(`/public/shop/${id}/catalogs${query({ branch_id })}`, [], req);
  }

  if (type === "status") {
    if (!branch_id) {
      return NextResponse.json(
        { detail: { code: "invalid_request", message: "branch_id required" } },
        { status: 400 }
      );
    }
    return proxyToBackend(
      `/public/shop/${id}/branches/${encodeURIComponent(branch_id)}/status`,
      { req }
    );
  }

  return NextResponse.json({ detail: "type required" }, { status: 400 });
}
