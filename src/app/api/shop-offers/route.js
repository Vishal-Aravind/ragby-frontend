// src/app/api/shop-offers/route.js
//
// Shop offers & coupons for the dashboard. The backend owns validation
// (code format and uniqueness, ranges, branch ids, limits) and the
// redemption counts; this route only forwards with the caller's JWT.
import { NextResponse } from "next/server";
import { authedProxy, readJson, UUID_RE } from "../shop-branches/_proxy";

export async function GET(req) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("project_id");
  if (!projectId || !UUID_RE.test(projectId)) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }
  const archived = url.searchParams.get("include_archived") === "true" ? "&include_archived=true" : "";
  return authedProxy(req, `/shop/offers?project_id=${encodeURIComponent(projectId)}${archived}`);
}

export async function POST(req) {
  const { body, error } = await readJson(req);
  if (error) return error;
  return authedProxy(req, "/shop/offers", { method: "POST", body });
}
