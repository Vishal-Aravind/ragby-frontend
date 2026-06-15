// src/app/api/public/shop/submit-cart/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { phone, project_id, catalog_id, items, delivery_type } = body;

    if (!phone || !project_id || !items?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Normalize phone — strip leading +
    const phoneNormalized = phone.replace(/^\+/, "");

    // Get shop config for GST
    const { data: config } = await supabase
      .from("shop_config")
      .select("gst_percent, currency")
      .eq("project_id", project_id)
      .maybeSingle();

    const gst_percent = config?.gst_percent || 0;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const gst_amount = parseFloat((subtotal * gst_percent / 100).toFixed(2));
    const total = parseFloat((subtotal + gst_amount).toFixed(2));

    // Create order — no catalog_id column in orders table
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        project_id,
        phone_number: phoneNormalized,
        items,
        subtotal,
        gst_amount,
        total,
        status: "pending",
        payment_status: "unpaid",
        delivery_type: delivery_type || "Takeaway",
      })
      .select()
      .single();

    if (orderError) {
      console.error("Order insert error:", orderError);
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // Upsert session so it works even if no session exists yet
    const { error: sessionError } = await supabase
      .from("whatsapp_sessions")
      .upsert({
        project_id,
        phone_number: phoneNormalized,
        mode: "awaiting_cart_confirm",
        metadata: { order_id: order.id, catalog_id: catalog_id || "" },
      }, { onConflict: "project_id,phone_number" });

    if (sessionError) {
      console.error("Session upsert error:", sessionError);
    }

    return NextResponse.json({ status: "ok", order_id: order.id });
  } catch (e) {
    console.error("submit-cart error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}