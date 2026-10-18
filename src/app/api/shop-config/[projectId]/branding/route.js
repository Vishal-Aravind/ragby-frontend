// src/app/api/shop-config/[projectId]/branding/route.js
//
// Shop cover image and logo. Goes through the backend (not a direct
// Supabase upsert like the main settings route) because the backend checks
// each URL is one of our own uploaded images.
import { NextResponse } from "next/server";
import { authedProxy, readJson, UUID_RE } from "../../../shop-branches/_proxy";

export async function PUT(req, { params }) {
  const { projectId } = await params;
  if (!UUID_RE.test(projectId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { body, error } = await readJson(req);
  if (error) return error;
  return authedProxy(req, `/shop-config/${encodeURIComponent(projectId)}/branding`, { method: "PUT", body });
}
