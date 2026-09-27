// app/api/sources/upload-excel/route.js

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend, LONG_SYNC_TIMEOUT_MS } from "@/lib/backend-proxy";

// Indexing a large sheet/file (thousands of rows, embedded in batches)
// takes well over 30s. The proxy used to give up at 30s and show
// "couldn't reach the server" while the backend carried on and finished,
// so the source appeared after a refresh and a retry could add it twice.
export const maxDuration = 300;

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Forward the multipart form directly to FastAPI. proxyToBackend detects
  // a FormData body and skips JSON-stringifying/setting Content-Type
  // itself, so the multipart boundary fetch generates survives intact.
  const formData = await req.formData();

  return proxyToBackend("/sources/upload-excel", {
    token: session.access_token,
    method: "POST",
    body: formData,
    timeoutMs: LONG_SYNC_TIMEOUT_MS,
  });
}