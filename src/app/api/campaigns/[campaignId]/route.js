// src/app/api/campaigns/[campaignId]/route.js
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

export async function PUT(req, { params }) {
  const { campaignId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const res = await fetch(`${BACKEND}/campaigns/${campaignId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: body.name,
      template_name: body.template_name,
      template_language: body.template_language,
      variables: body.variables,
      recipient_filter: body.recipient_filter,
      tag_filter: body.tag_filter,
      csv_contacts: body.csv_contacts || null,
      scheduled_at: body.scheduled_at || null,
      recurrence: body.recurrence || null,
    }),
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data.detail || "Failed" }, { status: res.status });
  return NextResponse.json(data);
}
