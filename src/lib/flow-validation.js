// Shared bounds for everything the Flows tab writes.
//
// The flow IS the WhatsApp bot: its nodes decide what every customer sees,
// which links they're sent, and whether their message reaches a paid AI
// call. None of these writes had any cap at all, and the sync route writes
// nodes in bulk, so a single request could store an unbounded graph.
//
// These live in one file because the same limits are enforced by three
// different routes (create, update, sync) and must not drift.

export const MAX_FLOWS_PER_PROJECT = 50;
export const MAX_FLOW_NAME = 120;
export const MAX_TRIGGER_KEYWORDS = 25;
export const MAX_TRIGGER_KEYWORD_LEN = 40;
export const MAX_NODES_PER_FLOW = 300;
export const MAX_EDGES_PER_FLOW = 600;
// Generous next to a real node (a long message body plus 3 buttons is well
// under 2 KB) but small enough that 300 of them can't blow up the row size.
export const MAX_NODE_CONTENT_BYTES = 20000;
export const MAX_TRIGGER_LEN = 120;

// Node types the runtime in backend/flows.py actually knows how to send.
// An unknown type is stored happily today and then silently does nothing
// when a customer reaches it — send_node falls through every branch.
export const WHATSAPP_NODE_TYPES = new Set([
  "message", "message_buttons", "message_list", "message_media",
  "message_video", "message_document", "message_audio", "message_location",
  "message_contact", "call_us", "ask_a_question", "back_to_menu",
  "talk_to_human", "time_delay", "message_shop", "message_booking",
  "message_event", "cta_url",
  // Legacy types still present in existing flows — accepted so an old flow
  // can still be re-saved, not offered in the editor's type dropdown.
  "text", "buttons", "list", "rag", "handoff",
]);

// Website flows (backend/web_flows/engine.py). No contact cards; adds
// richer inputs, logic and integrations.
export const WEB_NODE_TYPES = new Set([
  "message", "message_buttons", "message_list", "message_media",
  "message_video", "message_document", "message_audio", "message_location",
  "call_us", "ask_a_question", "back_to_menu", "talk_to_human", "time_delay",
  "message_shop", "message_booking", "message_event",
  "quick_replies", "carousel", "ask_input", "form", "rating", "set_variable",
  "condition", "webhook", "random_split", "open_url", "end",
]);

// Union, for the single-node routes that don't know the channel; the
// whole-graph save (validateGraph) checks per channel.
export const ALLOWED_NODE_TYPES = new Set([...WHATSAPP_NODE_TYPES, ...WEB_NODE_TYPES]);
export const FLOW_CHANNELS = new Set(["whatsapp", "web"]);

/** Returns an error string, or null when the value is acceptable. */
export function validateFlowName(name) {
  if (typeof name !== "string") return "Flow name is required.";
  const trimmed = name.trim();
  if (!trimmed) return "Flow name is required.";
  if (trimmed.length > MAX_FLOW_NAME) {
    return `Flow name must be ${MAX_FLOW_NAME} characters or fewer.`;
  }
  return null;
}

/**
 * Normalises trigger_keywords to a bounded, lowercased, de-duplicated array.
 * Returns { error } or { value }.
 *
 * Lowercasing here matters: backend/flows.py compares
 * `text.lower().strip() in keywords`, so a keyword stored with a capital
 * letter could never match anything a customer typed.
 */
export function normalizeTriggerKeywords(input) {
  if (!Array.isArray(input)) return { error: "trigger_keywords must be a list." };
  if (input.length > MAX_TRIGGER_KEYWORDS) {
    return { error: `At most ${MAX_TRIGGER_KEYWORDS} trigger keywords.` };
  }
  const seen = new Set();
  for (const k of input) {
    if (typeof k !== "string") continue;
    const clean = k.trim().toLowerCase().slice(0, MAX_TRIGGER_KEYWORD_LEN);
    if (clean) seen.add(clean);
  }
  return { value: [...seen] };
}

/**
 * Validates the node/edge graph a sync request is asking us to store.
 * Returns an error string, or null.
 */
const VAR_RE = /^[a-z][a-z0-9_]{0,31}$/;
const SYSTEM_VARS = new Set(["page_url", "page_path", "page_title", "webhook_status"]);
const len = (v) => (Array.isArray(v) ? v.length : 0);

// Per-node limits for website flows. Returns an error string or null.
function validateWebNode(type, c) {
  const varOk = (v, allowEmpty) => (allowEmpty && !v) || (VAR_RE.test(v || "") && !SYSTEM_VARS.has(v));
  if (["message_buttons", "quick_replies"].includes(type)) {
    const list = type === "quick_replies" ? c.options : c.buttons;
    if (len(list) > 50) return "A node can have at most 50 options.";
    if (c.var && !varOk(c.var)) return "Variable names use lowercase letters, numbers and _ (e.g. city).";
  }
  if (type === "message_list") {
    const rows = (c.sections || []).flatMap((s) => s.rows || []);
    if (rows.length > 50) return "A list can have at most 50 options.";
  }
  if (type === "carousel") {
    if (len(c.cards) > 10) return "A carousel can have at most 10 cards.";
    if ((c.cards || []).some((card) => len(card.buttons) > 3)) return "Each card can have at most 3 buttons.";
  }
  if (type === "ask_input" && !varOk(c.var)) return "Choose a variable name for the answer (e.g. name).";
  if (type === "rating" && !varOk(c.var, true)) return "Variable names use lowercase letters, numbers and _.";
  if (type === "form") {
    if (len(c.fields) > 10) return "A form can have at most 10 fields.";
    const names = new Set();
    for (const f of c.fields || []) {
      if (!varOk(f?.name)) return "Each form field needs a variable name (lowercase letters, numbers, _).";
      if (names.has(f.name)) return `Two form fields both save to "${f.name}".`;
      names.add(f.name);
    }
  }
  if (type === "set_variable") {
    if (len(c.assignments) > 20) return "At most 20 assignments per node.";
    if ((c.assignments || []).some((a) => !varOk(a?.var))) return "Set variable: each row needs a valid variable name.";
  }
  if (type === "condition") {
    if (len(c.rules) > 20) return "A condition can have at most 20 rules.";
    if ((c.rules || []).some((r) => len(r?.rows) > 10)) return "A rule can have at most 10 checks.";
  }
  if (type === "random_split") {
    if (len(c.branches) < 2 || len(c.branches) > 5) return "A random split needs 2 to 5 branches.";
    const total = (c.branches || []).reduce((n, b) => n + (Number(b?.weight) || 0), 0);
    if (total !== 100) return "Random split percentages must add up to 100.";
  }
  if (type === "webhook") {
    const url = String(c.url || "").trim();
    if (url && !url.toLowerCase().startsWith("https://")) return "The webhook URL must start with https://";
    const host = url.slice(8).split("/")[0];
    if (host.includes("{{")) return "Variables can only be used in the path or query of the webhook URL.";
    if (len(c.headers) > 10) return "A webhook can have at most 10 headers.";
    if (len(c.mappings) > 20) return "A webhook can map at most 20 values.";
    if ((c.mappings || []).some((m) => m?.var && !varOk(m.var))) return "Webhook mapping: invalid variable name.";
  }
  return null;
}

function numOr(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function validateWebSettings(input) {
  if (input == null) return { value: {} };
  if (typeof input !== "object" || Array.isArray(input)) return { error: "Invalid settings." };
  if (JSON.stringify(input).length > 8000) return { error: "Settings are too large." };
  const types = new Set(["time_on_page", "url_match", "exit_intent", "scroll_depth"]);
  const triggers = [];
  for (const t of (input.triggers || []).slice(0, 10)) {
    if (!t || !types.has(t.type)) continue;
    triggers.push({
      type: t.type,
      seconds: Math.max(1, Math.min(parseInt(t.seconds, 10) || 10, 600)),
      percent: Math.max(10, Math.min(parseInt(t.percent, 10) || 50, 100)),
      match: ["contains", "equals", "starts_with"].includes(t.match) ? t.match : "contains",
      value: String(t.value || "").slice(0, 300),
    });
  }
  return {
    value: {
      start_on_open: input.start_on_open !== false,
      display: input.display === "teaser" ? "teaser" : "open",
      teaser: String(input.teaser || "").slice(0, 140),
      // 0 is a real choice ("no cooldown"), so only a missing value defaults.
      cooldown_hours: Math.max(0, Math.min(numOr(input.cooldown_hours, 24), 720)),
      suppress_days: Math.max(0, Math.min(numOr(input.suppress_days, 7), 90)),
      triggers,
    },
  };
}

export function validateGraph(nodes, edges, channel = "whatsapp") {
  if (!Array.isArray(nodes)) return "nodes must be a list.";
  if (!Array.isArray(edges)) return "edges must be a list.";
  if (nodes.length > MAX_NODES_PER_FLOW) {
    return `A flow can have at most ${MAX_NODES_PER_FLOW} nodes.`;
  }
  if (edges.length > MAX_EDGES_PER_FLOW) {
    return `A flow can have at most ${MAX_EDGES_PER_FLOW} connections.`;
  }

  for (const node of nodes) {
    if (!node || typeof node !== "object") return "Invalid node.";
    const type = node.data?.type || node.type;
    const allowed = channel === "web" ? WEB_NODE_TYPES : WHATSAPP_NODE_TYPES;
    if (!allowed.has(type)) {
      return channel === "web" && WHATSAPP_NODE_TYPES.has(type)
        ? `"${String(type).slice(0, 40)}" nodes only work in WhatsApp flows.`
        : `Unknown node type: ${String(type).slice(0, 40)}`;
    }
    const content = node.data?.content ?? node.content ?? {};
    if (content === null || typeof content !== "object" || Array.isArray(content)) {
      return "Node content must be an object.";
    }
    if (JSON.stringify(content).length > MAX_NODE_CONTENT_BYTES) {
      return "One of your nodes is too large. Shorten its message.";
    }
    if (channel === "web") {
      const nodeError = validateWebNode(type, content);
      if (nodeError) return nodeError;
    }
  }

  for (const edge of edges) {
    if (!edge || typeof edge !== "object") return "Invalid connection.";
    const trigger = edge.sourceHandle || edge.trigger || "next";
    if (typeof trigger !== "string" || trigger.length > MAX_TRIGGER_LEN) {
      return "Invalid connection trigger.";
    }
  }

  return null;
}
