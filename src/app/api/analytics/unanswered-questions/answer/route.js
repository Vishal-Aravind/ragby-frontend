// src/app/api/analytics/unanswered-questions/answer/route.js
// Forwards a merchant-written answer to the FastAPI backend, which embeds
// it and adds it to the project's knowledge base (see backend/content_gaps.py).
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_BASE_URL;

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { project_id, question, answer } = await req.json();
  if (!project_id || !question?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: "project_id, question and answer are required" }, { status: 400 });
  }

  const res = await fetch(`${BACKEND}/content-gaps/answer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ project_id, question, answer }),
  });

  const text = await res.text();
  try { return NextResponse.json(JSON.parse(text), { status: res.status }); }
  catch { return NextResponse.json({ error: text }, { status: res.status }); }
}
