// Shared helper for the authenticated shop proxy routes (branches, copy-menu,
// order status). Forwards to the FastAPI backend with the caller's JWT, and
// turns the backend's error shape into the dashboard's `{ error }` shape.
//
// The shop endpoints raise HTTPException(detail={"code", "message"}), FastAPI
// validation errors use detail=[...], and older endpoints use a plain string.
// All three become `{ error: "<readable text>", code }`, so the UI only ever
// reads `data.error`.
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorText(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return "Some of the values aren't valid. Please check and try again.";
  if (detail && typeof detail.message === "string") return detail.message;
  return "Something went wrong. Please try again.";
}

export async function readJson(req) {
  try {
    return { body: await req.json() };
  } catch {
    return { error: NextResponse.json({ error: "Invalid request" }, { status: 400 }) };
  }
}

export async function authedProxy(req, path, { method = "GET", body } = {}) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await proxyToBackend(path, { token: session.access_token, method, body });
  if (res.status < 400) return res;

  const data = await res.json().catch(() => ({}));
  const detail = data?.detail;
  return NextResponse.json(
    { error: errorText(detail), code: detail && typeof detail === "object" && !Array.isArray(detail) ? detail.code || null : null },
    { status: res.status }
  );
}
