// src/app/api/shop-config/[projectId]/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireProjectTab } from "@/lib/supabase-api";

// FIX: razorpay_key_secret was previously returned to the browser on every
// GET/PUT via select("*") — a live merchant secret shipped into the
// dashboard's JS/network tab on every settings-page load. Explicit column
// list excluding it, used by both handlers below — write-only from here on.
const SHOP_CONFIG_SAFE_COLUMNS = "project_id, store_name, store_phone, gst_percent, currency, currency_code, accent_color, delivery_types, terms_note, razorpay_key_id, is_enabled, bot_can_assist, bot_can_order, cover_image_url, logo_url";
// cover_image_url / logo_url are read-only here: they are written through the
// backend's /shop-config/{pid}/branding endpoint (which validates the URL),
// so the upsert below deliberately doesn't list them and PostgREST leaves
// them untouched.

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

  // FIX: previously any logged-in user could read another project's shop
  // config here — including its Razorpay key/secret in plaintext. Now gated
  // on the shop tab rather than merely having some role on the project.
  const gate = await requireProjectTab(user.id, projectId, { tab: "shop" });
  if (!gate.ok) return gate.response;

  const { data, error } = await supabase
    .from("shop_config")
    .select(SHOP_CONFIG_SAFE_COLUMNS)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("shop-config write failed:", error);
    return NextResponse.json({ error: "Could not save your shop settings." }, { status: 500 });
  }
  return NextResponse.json(data || {});
}

export async function PUT(req, { params }) {
  const { projectId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Writing shop config sets prices, tax and the Razorpay keys, so it needs
  // the shop tab and admin — not just any role.
  const gate = await requireProjectTab(user.id, projectId, { tab: "shop", minRole: "admin" });
  if (!gate.ok) return gate.response;

  const body = await req.json();

  // The secret is never sent to the browser, so a normal settings save has
  // no secret in its body. Writing `body.razorpay_key_secret || null` wiped
  // a legacy merchant's stored secret (and with it online payments) on every
  // save. Only write it when the merchant actually typed a new one.
  const newSecret = typeof body.razorpay_key_secret === "string" ? body.razorpay_key_secret.trim() : "";

  const { data, error } = await supabase
    .from("shop_config")
    .upsert({
      ...(newSecret ? { razorpay_key_secret: newSecret } : {}),
      project_id: projectId,
      store_name: body.store_name || null,
      gst_percent: body.gst_percent ?? 0,
      currency: body.currency || "₹",
      accent_color: body.accent_color || "#16a34a",
      delivery_types: body.delivery_types || ["Takeaway"],
      terms_note: body.terms_note || null,
      razorpay_key_id: body.razorpay_key_id || null,
      is_enabled: body.is_enabled ?? false,
      bot_can_assist: body.bot_can_assist ?? false,
      bot_can_order: body.bot_can_order ?? false,
    }, { onConflict: "project_id" })
    .select(SHOP_CONFIG_SAFE_COLUMNS)
    .single();

  if (error) {
    console.error("shop-config write failed:", error);
    return NextResponse.json({ error: "Could not save your shop settings." }, { status: 500 });
  }
  return NextResponse.json(data);
}