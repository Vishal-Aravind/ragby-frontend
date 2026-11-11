// src/app/api/shop-branches/[branchId]/copy-menu/route.js
//
// Copies another branch's catalogs + products into this branch (atomic RPC
// on the backend). mode: "append" | "replace".
import { NextResponse } from "next/server";
import { authedProxy, readJson, UUID_RE } from "../../_proxy";

export async function POST(req, { params }) {
  const { branchId } = await params;
  if (!UUID_RE.test(branchId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { body, error } = await readJson(req);
  if (error) return error;
  return authedProxy(req, `/shop/branches/${encodeURIComponent(branchId)}/copy-menu`, {
    method: "POST",
    body: {
      source_branch_id: body?.source_branch_id,
      mode: body?.mode === "replace" ? "replace" : "append",
    },
  });
}
