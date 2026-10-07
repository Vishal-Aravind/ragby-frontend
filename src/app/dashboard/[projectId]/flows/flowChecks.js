// flowChecks.js
//
// Editor-side checks for website flows. Warnings only — saving is never
// blocked — but each one is something that would otherwise leave a visitor
// stuck or silently skip a step.
import { getSourceHandles } from "@/lib/flow-handles";
import { canonicalType, nodeInfo } from "./nodeRegistry";

// Filled in automatically: page details on the website; the customer's
// WhatsApp profile name and number on WhatsApp.
const SYSTEM_VARS = { web: ["page_url", "page_path", "page_title"], whatsapp: ["name", "phone"] };
const INPUT_TYPES = new Set(["message_buttons", "quick_replies", "message_list", "carousel", "ask_input", "form", "rating"]);
const TEMPLATE_RE = /\{\{\s*([a-z][a-z0-9_]{0,31})\s*(?:\|[^{}]*)?\}\}/g;

/** Variable names the flow collects (plus the built-in page ones). */
export function flowVariables(nodes, channel = "web") {
  const found = new Set();
  for (const n of nodes || []) {
    const t = canonicalType(n.data?.type);
    const c = n.data?.content || {};
    if (["ask_input", "rating", "quick_replies", "message_buttons", "message_list"].includes(t) && c.var) found.add(c.var);
    if (t === "form") (c.fields || []).forEach(f => f?.name && found.add(f.name));
  }
  const system = SYSTEM_VARS[channel] || [];
  return [...new Set([...[...found].sort(), ...system])];
}

function textsOf(c) {
  const out = [c.body, c.title, c.url];
  (c.cards || []).forEach(card => out.push(card?.title, card?.text));
  return out.filter(v => typeof v === "string");
}

/** [{nodeId|null, message}] */
export function flowWarnings(nodes, edges, channel) {
  if (channel !== "web") return [];
  const warnings = [];
  const list = nodes || [];
  if (!list.length) return warnings;
  const start = list.find(n => n.data?.isStart);
  if (!start) warnings.push({ nodeId: null, message: "No start node - open a node and tick \"Set as start node\"." });

  const out = {};
  for (const e of edges || []) (out[e.source] ||= new Set()).add(e.sourceHandle || "next");
  const known = new Set(flowVariables(list, "web"));

  // Reachability from the start node.
  const reach = new Set();
  if (start) {
    const stack = [start.id];
    while (stack.length) {
      const id = stack.pop();
      if (reach.has(id)) continue;
      reach.add(id);
      for (const e of edges || []) if (e.source === id) stack.push(e.target);
    }
  }

  for (const n of list) {
    const t = canonicalType(n.data?.type);
    const c = n.data?.content || {};
    const label = nodeInfo(t).label;
    const used = out[n.id] || new Set();
    if (start && !reach.has(n.id) && t !== "back_to_menu") {
      warnings.push({ nodeId: n.id, message: `${label}: can't be reached from the start node.` });
    }
    if (INPUT_TYPES.has(t) && ["message_buttons", "quick_replies", "message_list", "carousel"].includes(t)) {
      const handles = getSourceHandles(t, c, "web");
      const loose = handles.filter(h => !used.has(h.id));
      if (handles.length && loose.length === handles.length) warnings.push({ nodeId: n.id, message: `${label}: none of its options is connected yet.` });
    }
    if (t === "form" && c.save_lead && !(c.fields || []).some(f => ["email", "phone"].includes(f?.name))) {
      warnings.push({ nodeId: n.id, message: "Form: \"Save to Leads\" needs a field saved as email or phone." });
    }
    for (const text of textsOf(c)) {
      for (const m of text.matchAll(TEMPLATE_RE)) {
        if (!known.has(m[1])) warnings.push({ nodeId: n.id, message: `${label}: {{${m[1]}}} is never set in this flow.` });
      }
    }
  }

  // Loops with no question in them would spin until the safety cap.
  const byId = Object.fromEntries(list.map(n => [n.id, n]));
  const adj = {};
  for (const e of edges || []) {
    const src = byId[e.source];
    if (src && !INPUT_TYPES.has(canonicalType(src.data?.type))) (adj[e.source] ||= []).push(e.target);
  }
  const state = {};
  let loop = false;
  const visit = (id) => {
    if (loop) return;
    state[id] = 1;
    for (const nx of adj[id] || []) {
      if (state[nx] === 1) { loop = true; return; }
      if (!state[nx]) visit(nx);
    }
    state[id] = 2;
  };
  Object.keys(adj).forEach(id => { if (!state[id]) visit(id); });
  if (loop) warnings.push({ nodeId: null, message: "There's a loop with no question in it - visitors would go round in circles. Add a question or end it." });

  return warnings;
}
