// app/api/flows/check-media-link/route.js
import { NextResponse } from "next/server";
import { getSupabase, getToken } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

// Asks the backend to open a pasted media link and confirm it's a file
// WhatsApp can send (see backend/media_check.py).
export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const token = await getToken(supabase);
  return proxyToBackend("/flows/check-media-link", { token, method: "POST", body, timeoutMs: 15000 });
}
