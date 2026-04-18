//app\api\chat\ask\route.js

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function POST(req) {
  try {
    const { supabase } = getSupabase(req);

    // 🔐 Get logged-in user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { projectId, chatId, message } = await req.json();

    // 🚀 Call FastAPI backend
    const res = await fetch(`${process.env.BACKEND_BASE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        chatId,
        message
      }),
    });

    // ❌ Handle backend error
    if (!res.ok) {
      const errorText = await res.text();
      console.error("FastAPI Backend Error:", errorText);

      return NextResponse.json(
        { error: "RAG Backend failed", details: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json(data);

  } catch (error) {
    console.error("Ask Route Error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}