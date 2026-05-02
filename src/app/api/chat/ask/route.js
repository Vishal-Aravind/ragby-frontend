// app/api/chat/ask/route.js

import { NextResponse } from "next/server";
import { getSupabase, getToken } from "@/lib/supabase-api";

export async function POST(req) {
  try {
    const { supabase } = getSupabase(req);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // FIX: get the raw access token to forward to FastAPI
    const token = await getToken(supabase);

    if (!token) {
      return NextResponse.json({ error: "No session token" }, { status: 401 });
    }

    const { projectId, chatId, message } = await req.json();

    const res = await fetch(`${process.env.BACKEND_BASE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`, // FIX: forward JWT to FastAPI
      },
      body: JSON.stringify({ projectId, chatId, message }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("FastAPI Backend Error:", errorText);
      return NextResponse.json(
        { error: "RAG Backend failed", details: errorText },
        { status: res.status }
      );
    }

    return NextResponse.json(await res.json());

  } catch (error) {
    console.error("Ask Route Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}