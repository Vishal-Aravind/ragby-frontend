// src/app/api/public/shop/[projectId]/branches/route.js
import { proxyToBackend } from "@/lib/backend-proxy";

// Branch list ranked by the visitor's location ({lat,lng} or {pincode}, both
// optional). The backend does any pincode geocoding itself; the browser never
// talks to Nominatim. `req` forwards the visitor IP so per-IP limits work.
export async function POST(req, { params }) {
  const { projectId } = await params;
  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {
    body = {};
  }
  return proxyToBackend(`/public/shop/${encodeURIComponent(projectId)}/branches`, {
    req,
    method: "POST",
    body,
  });
}

