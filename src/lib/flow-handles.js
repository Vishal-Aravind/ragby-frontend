// lib/flow-handles.js
//
// Which outgoing connections ("handles") a flow node has. One answer, used
// by the canvas (which dots to draw), the save filter (which lines to keep)
// and the server's validation (which triggers to accept) — when those three
// disagreed, lines were drawn that the bot silently ignored.
//
// Pure, no React — imported by API routes too.

// The id a button/list option is sent with — MUST match option_id() in
// backend/flow_common.py, which the WhatsApp bot uses to find the
// connection. Labels with no a-z/0-9 at all (Tamil, emoji) get a stable hash
// of their UTF-8 bytes.
export function optionId(label) {
  const text = (label || "").trim();
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (slug) return slug;
  let h = 5381;
  for (const b of new TextEncoder().encode(text)) h = ((h * 33) ^ b) >>> 0;
  return "opt_" + h.toString(36);
}

// Website options carry a stable id of their own, so renaming a chip never
// breaks its connection.
export function newOptionId(prefix = "o") {
  const rand = Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  return `${prefix}_${rand}`;
}

// WhatsApp: exactly today's rules (see backend/flows.py _CONTINUING_TYPES).
const WA_NEXT = new Set(["time_delay", "message_shop"]);

// Website: everything that just shows something continues on "next".
const WEB_NEXT = new Set([
  "message", "message_media", "message_video", "message_audio", "message_document",
  "message_location", "call_us", "open_url", "message_shop", "message_booking",
  "message_event", "ask_input", "form", "rating", "time_delay",
]);

const LEGACY = { text: "message", buttons: "message_buttons", list: "message_list", handoff: "talk_to_human" };
const canon = (t) => LEGACY[t] || t;

function labelled(list, useIds) {
  const out = [];
  const seen = new Set();
  for (const o of list || []) {
    const label = String(o?.label || o?.title || "").trim();
    if (!label) continue;
    const id = (useIds && o?.id) ? String(o.id) : optionId(label);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label });
  }
  return out;
}

/** [{id, label}] — the outgoing handles of a node. */
export function getSourceHandles(type, content, channel = "whatsapp") {
  const t = canon(type);
  const c = content || {};
  const web = channel === "web";

  if (t === "message_buttons") return labelled(c.buttons, web);
  if (t === "message_list") return labelled((c.sections || []).flatMap((s) => s.rows || []), web);

  if (!web) return WA_NEXT.has(t) ? [{ id: "next", label: "" }] : [];

  if (t === "quick_replies") return labelled(c.options, true);
  if (t === "carousel") {
    // id falls back to the BUTTON label alone, as the engine does
    // (web_flows/engine.py _options); the card title is display only.
    return labelled((c.cards || []).flatMap((card) =>
      (card.buttons || []).filter((b) => !b.url && String(b?.label || "").trim()).map((b) => ({
        id: b.id || optionId(b.label), label: card.title ? `${card.title}: ${b.label}` : b.label,
      }))), true);
  }
  return WEB_NEXT.has(t) ? [{ id: "next", label: "" }] : [];
}

/** True when the node has the single plain "next" handle. */
export function hasSingleNext(handles) {
  return handles.length === 1 && handles[0].id === "next";
}
