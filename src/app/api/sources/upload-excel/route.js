// app/api/sources/upload-excel/route.js

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Forward the multipart form directly to FastAPI
  const formData = await req.formData();

  const res = await fetch(`${process.env.BACKEND_BASE_URL}/sources/upload-excel`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      // Don't set Content-Type — let fetch set it with the boundary for multipart
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}