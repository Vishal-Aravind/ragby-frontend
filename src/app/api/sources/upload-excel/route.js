// app/api/sources/upload-excel/route.js

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

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
  });
}