// ─────────────────────────────────────────────────────────
// app/api/sources/[id]/database-columns/route.js — GET/PUT which tables
// and columns of a connected database the AI may query
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";

async function getToken(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

export async function GET(req, { params }) {
  const { id } = await params;
  const token = await getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return proxyToBackend(`/sources/${id}/database-columns`, { token });
}

export async function PUT(req, { params }) {
  const { id } = await params;
  const token = await getToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  return proxyToBackend(`/sources/${id}/database-columns`, { token, method: "PUT", body });
}
