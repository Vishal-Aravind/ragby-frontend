// ─────────────────────────────────────────────────────────
// app/api/chat/public/verify-password/route.js
// Proxies to the FastAPI backend, which does the actual check + attempt
// rate-limiting — moved there because Next.js API routes run serverless
// (Vercel), so an in-memory attempt counter here wouldn't reliably persist
// between requests the way it does on the backend's long-running process.
// ─────────────────────────────────────────────────────────
import { proxyToBackend } from "@/lib/backend-proxy";

export async function POST(req) {
  const { projectId, password } = await req.json();
  return proxyToBackend("/public/chat/verify-password", {
    req,
    method: "POST",
    body: { projectId, password },
  });
}

