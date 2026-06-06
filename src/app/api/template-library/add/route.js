// src/app/api/template-library/add/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://ragby-backend.onrender.com";

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

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const res = await fetch(`${BACKEND}/template-library/add`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      project_id: body.projectId,
      template_id: body.template_id,
    }),
  });

  const data = await res.json();
  if (!res.ok && data.status !== 'exists') {
    return NextResponse.json({ error: data.detail || "Failed" }, { status: res.status });
  }
  return NextResponse.json(data);
}