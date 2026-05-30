// src/app/api/conversations/[chatId]/reply/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getSupabase(req) {
  const response = NextResponse.next();
  return {
    supabase: createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name) => req.cookies.get(name)?.value,
          set: (name, value, options) => response.cookies.set({ name, value, ...options }),
          remove: (name, options) => response.cookies.set({ name, value: "", ...options }),
        },
      }
    ),
  };
}

export async function POST(req, { params }) {
  const { chatId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, project_id, phone_number } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

  // Get auth token for backend
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://ragby-backend.onrender.com";

  const res = await fetch(`${backendUrl}/whatsapp/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ project_id, phone_number, message }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: err.detail || "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ status: "sent" });
}