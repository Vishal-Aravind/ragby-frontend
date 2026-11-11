// src/app/api/shop-branches/[branchId]/route.js
import { NextResponse } from "next/server";
import { authedProxy, readJson, UUID_RE } from "../_proxy";

export async function PUT(req, { params }) {
  const { branchId } = await params;
  if (!UUID_RE.test(branchId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { body, error } = await readJson(req);
  if (error) return error;
  return authedProxy(req, `/shop/branches/${encodeURIComponent(branchId)}`, { method: "PUT", body });
}

export async function DELETE(req, { params }) {
  const { branchId } = await params;
  if (!UUID_RE.test(branchId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return authedProxy(req, `/shop/branches/${encodeURIComponent(branchId)}`, { method: "DELETE" });
}
