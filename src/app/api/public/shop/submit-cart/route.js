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

    // Get shop config for GST
    const { data: config } = await supabase
      .from("shop_config")
      .select("gst_percent, currency")
      .eq("project_id", project_id)
      .maybeSingle();

    const gst_percent = config?.gst_percent || 0;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const gst_amount = Math.round(subtotal * gst_percent) / 100;
    const total = subtotal + gst_amount;

    // Create order
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        project_id,
        phone_number: phone.replace("+", ""),
        items,
        subtotal,
        gst_amount,
        total,
        status: "pending",
        payment_status: "unpaid",
        delivery_type: delivery_type || "Takeaway",
        catalog_id: catalog_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Order insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update whatsapp session to awaiting_cart_confirm
    await supabase
      .from("whatsapp_sessions")
      .update({
        mode: "awaiting_cart_confirm",
        metadata: { order_id: order.id, catalog_id: catalog_id || "" },
      })
      .eq("project_id", project_id)
      .eq("phone_number", phone.replace("+", ""));

    // Send WhatsApp message via backend (fire and forget)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (backendUrl) {
      fetch(`${backendUrl}/public/shop/notify-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id, phone, order_id: order.id }),
      }).catch(e => console.log("notify-cart fire-and-forget failed:", e));
    }

    return NextResponse.json({ status: "ok", order_id: order.id });
  } catch (e) {
    console.error("submit-cart error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
