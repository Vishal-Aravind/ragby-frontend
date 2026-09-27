// ─────────────────────────────────────────────────────────
// app/api/sources/preview-excel/route.js — POST: read an Excel file's
// columns before uploading it as a source (nothing is stored or indexed)
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Multipart is forwarded as-is; see upload-excel/route.js.
  const formData = await req.formData();
  return proxyToBackend("/sources/preview-excel", {
    token: session.access_token,
    method: "POST",
    body: formData,
  });
}
