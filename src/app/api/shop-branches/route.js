// src/app/api/shop-branches/route.js
//
// Shop branches for the dashboard. The backend owns validation (phone
// normalising, hours, pincodes, limits) and creates the default "Main"
// branch on first read.
import { NextResponse } from "next/server";
import { authedProxy, readJson, UUID_RE } from "./_proxy";

export async function GET(req) {
  const projectId = new URL(req.url).searchParams.get("project_id");
  if (!projectId || !UUID_RE.test(projectId)) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }
  return authedProxy(req, `/shop/branches?project_id=${encodeURIComponent(projectId)}`);
}

export async function POST(req) {
  const { body, error } = await readJson(req);
  if (error) return error;
  return authedProxy(req, "/shop/branches", { method: "POST", body });
}
