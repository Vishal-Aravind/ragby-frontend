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
export const ALLOWED_NODE_TYPES = new Set([
  "message", "message_buttons", "message_list", "message_media",
  "message_video", "message_document", "message_audio", "message_location",
  "message_contact", "call_us", "ask_a_question", "back_to_menu",
  "talk_to_human", "time_delay", "message_shop", "message_booking",
  "message_event", "cta_url",
  // Legacy types still present in existing flows — accepted so an old flow
  // can still be re-saved, not offered in the editor's type dropdown.
  "text", "buttons", "list", "rag", "handoff",
]);

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
export function validateGraph(nodes, edges) {
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
    if (!ALLOWED_NODE_TYPES.has(type)) {
      return `Unknown node type: ${String(type).slice(0, 40)}`;
    }
    const content = node.data?.content ?? node.content ?? {};
    if (content === null || typeof content !== "object" || Array.isArray(content)) {
      return "Node content must be an object.";
    }
    if (JSON.stringify(content).length > MAX_NODE_CONTENT_BYTES) {
      return "One of your nodes is too large. Shorten its message.";
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
