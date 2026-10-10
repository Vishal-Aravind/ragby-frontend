// src/app/api/conversations/[chatId]/details/route.js
// The "Details" panel beside a conversation: who this is (from Leads) and
// every answer the flow collected — kept on the contact (custom_fields) plus
// anything still only in the live session.
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getProjectRole } from "@/lib/supabase-api";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

const LEAD_COLUMNS = "id, name, email, phone, source, channel, tags, custom_fields, created_at, last_seen_at";
// Filled in automatically, not answers the customer gave.
const HIDDEN_VARS = new Set(["page_url", "page_path", "page_title"]);

export async function GET(req, { params }) {
  const { chatId } = await params;
  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: chat } = await supabaseAdmin
    .from("chats").select("project_id, channel, external_id, visitor_id, lead_id").eq("id", chatId).maybeSingle();
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = await getProjectRole(user.id, chat.project_id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let lead = null;
  let sessionVars = {};

  if (chat.channel === "whatsapp" && chat.external_id) {
    const [{ data: leads }, { data: sessions }] = await Promise.all([
      supabaseAdmin.from("leads").select(LEAD_COLUMNS)
        .eq("project_id", chat.project_id).eq("phone", chat.external_id).limit(1),
      supabaseAdmin.from("whatsapp_sessions").select("variables")
        .eq("project_id", chat.project_id).eq("phone_number", chat.external_id).limit(1),
    ]);
    lead = leads?.[0] || null;
    sessionVars = sessions?.[0]?.variables || {};
  } else if (chat.channel === "public") {
    const { data: sessions } = await supabaseAdmin.from("web_flow_sessions")
      .select("variables, lead_id, visitor_id").eq("chat_id", chatId).eq("project_id", chat.project_id).limit(1);
    const s = sessions?.[0];
    sessionVars = s?.variables || {};
    // Flow chats know their lead directly; plain AI chats via the visitor id
    // the widget sends (the same key lead capture saves the lead under).
    const visitor = s?.visitor_id || chat.visitor_id;
    // The contact saved on the chat wins: it survives the contact moving to
    // another browser, which changes leads.session_id.
    const leadId = chat.lead_id || s?.lead_id;
    if (leadId || visitor) {
      const q = supabaseAdmin.from("leads").select(LEAD_COLUMNS).eq("project_id", chat.project_id).limit(1);
      const { data: leads } = leadId ? await q.eq("id", leadId) : await q.eq("session_id", visitor);
      lead = leads?.[0] || null;
    }
  }

  // Saved answers first, then anything only in the current session.
  const answers = { ...(lead?.custom_fields || {}) };
  for (const [k, v] of Object.entries(sessionVars)) {
    if (HIDDEN_VARS.has(k) || v === "" || v == null) continue;
    if (["name", "email", "phone"].includes(k) && lead?.[k]) continue;
    answers[k] = v;
  }

  return NextResponse.json({
    channel: chat.channel,
    contact: lead ? {
      name: lead.name || "", email: lead.email || "", phone: lead.phone || chat.external_id || "",
      tags: lead.tags || [], source: lead.source || lead.channel || "",
      created_at: lead.created_at, last_seen_at: lead.last_seen_at,
    } : (chat.external_id && chat.channel === "whatsapp" ? { phone: chat.external_id, name: "", email: "", tags: [] } : null),
    answers,
  });
}
