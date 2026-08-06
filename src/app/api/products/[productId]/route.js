// src/app/api/products/[productId]/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getProjectRole } from "@/lib/supabase-api";

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
  const { productId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existingProduct } = await supabase
    .from("products")
    .select("project_id")
    .eq("id", productId)
    .maybeSingle();
  if (!existingProduct) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await getProjectRole(user.id, existingProduct.project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const update = {};
  if ("name" in body) update.name = body.name;
  if ("description" in body) update.description = body.description;
  if ("price" in body) update.price = body.price;
  if ("image_url" in body) update.image_url = body.image_url;
  if ("category" in body) update.category = body.category;
  if ("gst_percent" in body) update.gst_percent = body.gst_percent;
  if ("is_available" in body) update.is_available = body.is_available;
  if ("sort_order" in body) update.sort_order = body.sort_order;

  const { data, error } = await supabase
    .from("products")
    .update(update)
    .eq("id", productId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req, { params }) {
  const { productId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existingProduct } = await supabase
    .from("products")
    .select("project_id")
    .eq("id", productId)
    .maybeSingle();
  if (!existingProduct) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await getProjectRole(user.id, existingProduct.project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabase.from("products").delete().eq("id", productId);
  return NextResponse.json({ status: "deleted" });
}
