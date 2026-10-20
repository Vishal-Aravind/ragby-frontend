// src/app/api/shop-config/[projectId]/invoice/route.js
// Tax invoice seller details (legal name, GSTIN, address, state). Goes
// through the backend, which validates the GSTIN and checks access
// (shop tab to read, admin to write). No secrets are involved.
import { NextResponse } from "next/server";
import { authedProxy, readJson, UUID_RE } from "@/app/api/shop-branches/_proxy";

export async function GET(req, { params }) {
  const { projectId } = await params;
  if (!UUID_RE.test(projectId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return authedProxy(req, `/shop-config/${encodeURIComponent(projectId)}/invoice`);
}

export async function PUT(req, { params }) {
  const { projectId } = await params;
  if (!UUID_RE.test(projectId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { body, error } = await readJson(req);
  if (error) return error;
  const payload = {};
  for (const k of ["legal_name", "gstin", "registered_address", "state"]) {
    if (body && k in body) payload[k] = typeof body[k] === "string" ? body[k] : null;
  }
  return authedProxy(req, `/shop-config/${encodeURIComponent(projectId)}/invoice`, { method: "PUT", body: payload });
}
