// src/app/api/public/shop/[projectId]/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public client — no auth needed for shop browsing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "config" or "products"
  const catalog_id = searchParams.get("catalog_id");

  if (type === "config") {
    const { data, error } = await supabase
      .from("shop_config")
      .select("store_name, store_phone, gst_percent, currency, accent_color, delivery_types, terms_note, is_enabled")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) return NextResponse.json({}, { status: 500 });
    return NextResponse.json(data || {});
  }

  if (type === "products") {
    let query = supabase
      .from("products")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_available", true)
      .order("sort_order", { ascending: true });

    if (catalog_id) query = query.eq("catalog_id", catalog_id);

    const { data, error } = await query;
    if (error) return NextResponse.json([], { status: 500 });
    return NextResponse.json(data || []);
  }

  return NextResponse.json({ error: "type required" }, { status: 400 });
}
