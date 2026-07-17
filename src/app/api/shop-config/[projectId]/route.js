// src/app/api/shop-config/[projectId]/route.js
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

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("shop_config")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || {});
}

export async function PUT(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const { data, error } = await supabase
    .from("shop_config")
    .upsert({
      project_id: projectId,
      store_name: body.store_name || null,
      store_phone: body.store_phone || null,
      gst_percent: body.gst_percent ?? 0,
      currency: body.currency || "₹",
      accent_color: body.accent_color || "#16a34a",
      delivery_types: body.delivery_types || ["Takeaway"],
      terms_note: body.terms_note || null,
      razorpay_key_id: body.razorpay_key_id || null,
      razorpay_key_secret: body.razorpay_key_secret || null,
      is_enabled: body.is_enabled ?? false,
      bot_can_assist: body.bot_can_assist ?? false,
      bot_can_order: body.bot_can_order ?? false,
    }, { onConflict: "project_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}