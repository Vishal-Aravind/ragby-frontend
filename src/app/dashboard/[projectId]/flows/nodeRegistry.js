// nodeRegistry.js
//
// Single source of truth for every flow node type — what it's called, what
// it does, which category it sits under in the Add Node panel, its default
// content, its color, and which channels (WhatsApp / Website) it exists on.
// WhatsApp and Website flows are separate flows with separate palettes:
// the website can do more (unlimited options, carousels, forms, branching,
// webhooks) because it isn't bound by WhatsApp's message limits.
import {
  MessageSquare, SquareMousePointer, ListChecks, Image, Video, FileText,
  Music, MapPin, User, PhoneCall, ShoppingCart, CalendarDays, CalendarPlus,
  Clock, CornerUpLeft, Sparkles, Headset, MousePointerClick, GalleryHorizontal,
  TextCursorInput, ClipboardList, Star, Variable, GitBranch, Webhook, Shuffle,
  ExternalLink, CircleStop,
} from "lucide-react";
import { optionId as sharedOptionId, newOptionId as sharedNewOptionId } from "@/lib/flow-handles";

export const CATEGORIES = ["Messages", "Interactive", "Collect", "Actions", "Logic", "Integrations", "AI & Handoff"];

// type -> canonical type. Safe because backend/flows.py's send_node()
// dispatches these pairs identically (`t in ("text","message")`, etc.) —
// confirmed against the backend, not assumed. Applied when a node is
// loaded/saved so old and new flows converge onto one type string.
export const LEGACY_ALIASES = {
  text: "message",
  buttons: "message_buttons",
  list: "message_list",
  handoff: "talk_to_human",
};

// Exist in saved flows and still work via the backend, but are deliberately
// NOT in NODE_REGISTRY (so they don't appear in the Add Node panel) and NOT
// in LEGACY_ALIASES — "rag" and "ask_a_question" send genuinely different
// things (rag has no session-mode switch or back-to-menu button), and
// "cta_url" was already retired from the add flow before this change.
// Kept here only so FlowNode can still render their color/label if an old
// flow happens to have one.
export const RENDER_ONLY_TYPES = {
  rag:     { label: "AI Answer (legacy)", icon: Sparkles,  bg: "#fffbeb", border: "#fcd34d", text: "#78350f", badge: "#fef3c7" },
  cta_url: { label: "Send Link (legacy)", icon: FileText,  bg: "#fff7ed", border: "#fdba74", text: "#9a3412", badge: "#ffedd5" },
};

const BOTH = ["whatsapp", "web"];
const WA = ["whatsapp"];
const WEB = ["web"];

export const NODE_REGISTRY = [
  {
    type: "message", category: "Messages", label: "Message", icon: MessageSquare, channels: BOTH,
    description: "Send a plain text message.",
    bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#dcfce7",
    emptyContent: { body: "" },
  },
  {
    type: "message_media", category: "Messages", label: "Image", icon: Image, channels: BOTH,
    description: "Send a message with an image attached.",
    bg: "#fff7ed", border: "#fdba74", text: "#9a3412", badge: "#ffedd5",
    emptyContent: { body: "", media_url: "" },
  },
  {
    type: "message_video", category: "Messages", label: "Video", icon: Video, channels: BOTH,
    description: "Send a message with a video attached.",
    bg: "#fdf4ff", border: "#e879f9", text: "#86198f", badge: "#fae8ff",
    emptyContent: { body: "", video_url: "" },
  },
  {
    type: "message_document", category: "Messages", label: "Document", icon: FileText, channels: BOTH,
    description: "Send a PDF, Word, Excel or other file.",
    bg: "#f0f9ff", border: "#7dd3fc", text: "#0c4a6e", badge: "#e0f2fe",
    emptyContent: { body: "", document_url: "", filename: "" },
  },
  {
    type: "message_audio", category: "Messages", label: "Audio", icon: Music, channels: BOTH,
    description: "Send a voice note or audio clip.",
    bg: "#fdf4ff", border: "#d946ef", text: "#701a75", badge: "#fae8ff",
    emptyContent: { body: "", audio_url: "" },
  },
  {
    type: "message_location", category: "Messages", label: "Location", icon: MapPin, channels: BOTH,
    description: "Send a location the customer can open in Maps.",
    bg: "#f0fdf4", border: "#4ade80", text: "#14532d", badge: "#dcfce7",
    emptyContent: { body: "", latitude: "", longitude: "", name: "", address: "" },
  },
  {
    type: "message_contact", category: "Messages", label: "Contact", icon: User, channels: WA,
    description: "Send a WhatsApp contact card.",
    bg: "#fafafa", border: "#a1a1aa", text: "#18181b", badge: "#f4f4f5",
    emptyContent: { body: "", contact_name: "", contact_phone: "" },
  },
  {
    type: "message_buttons", category: "Interactive", label: "Buttons", icon: SquareMousePointer, channels: BOTH,
    description: "Ask a question with tappable buttons, each leading somewhere different.",
    webDescription: "Ask a question with stacked buttons, each leading somewhere different.",
    bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", badge: "#dbeafe",
    emptyContent: { body: "", buttons: [{ label: "Option 1" }, { label: "Option 2" }] },
  },
  {
    type: "quick_replies", category: "Interactive", label: "Quick replies", icon: MousePointerClick, channels: WEB,
    description: "Ask a question with tappable chips - as many as you like, each leading somewhere different.",
    bg: "#eef2ff", border: "#a5b4fc", text: "#3730a3", badge: "#e0e7ff",
    emptyContent: { body: "", options: [{ label: "Option 1" }, { label: "Option 2" }], var: "" },
  },
  {
    type: "message_list", category: "Interactive", label: "List", icon: ListChecks, channels: BOTH,
    description: "Ask a question with a scrollable list of options, grouped into sections.",
    bg: "#faf5ff", border: "#c4b5fd", text: "#5b21b6", badge: "#ede9fe",
    emptyContent: { body: "", button_text: "View Options", sections: [{ title: "", rows: [{ label: "Option 1" }, { label: "Option 2" }] }] },
  },
  {
    type: "carousel", category: "Interactive", label: "Carousel", icon: GalleryHorizontal, channels: WEB,
    description: "Swipeable cards with an image, title, text and buttons - great for products, services or plans.",
    bg: "#fff1f2", border: "#fda4af", text: "#9f1239", badge: "#ffe4e6",
    emptyContent: { body: "", cards: [
      { title: "Card 1", text: "", image: "", buttons: [{ label: "Choose" }] },
      { title: "Card 2", text: "", image: "", buttons: [{ label: "Choose" }] },
    ] },
  },
  {
    type: "ask_input", category: "Collect", label: "Ask a question", icon: TextCursorInput, channels: WEB,
    description: "Ask for one answer (text, email, phone, number or date) and save it as a variable.",
    bg: "#ecfeff", border: "#67e8f9", text: "#155e75", badge: "#cffafe",
    emptyContent: { body: "What's your name?", input_type: "text", var: "name", placeholder: "", required: true },
  },
  {
    type: "form", category: "Collect", label: "Form", icon: ClipboardList, channels: WEB,
    description: "Collect several answers in one card. Can save the visitor to Leads.",
    bg: "#ecfeff", border: "#22d3ee", text: "#164e63", badge: "#cffafe",
    emptyContent: {
      body: "", title: "Your details", submit_label: "Send", save_lead: true,
      fields: [
        { name: "name", type: "text", label: "Name", required: true },
        { name: "email", type: "email", label: "Email", required: true },
        { name: "phone", type: "phone", label: "Phone", required: false },
      ],
    },
  },
  {
    type: "rating", category: "Collect", label: "Rating", icon: Star, channels: WEB,
    description: "Ask for a 1-5 star rating or a 0-10 score and save it as a variable.",
    bg: "#fefce8", border: "#fde047", text: "#854d0e", badge: "#fef9c3",
    emptyContent: { body: "How did we do?", style: "stars", var: "rating" },
  },
  {
    type: "call_us", category: "Actions", label: "Call Us", icon: PhoneCall, channels: BOTH,
    description: "Send a button that opens the customer's phone dialer.",
    bg: "#fff7ed", border: "#fdba74", text: "#9a3412", badge: "#ffedd5",
    emptyContent: { body: "Need help? Call us directly!", phone: "" },
  },
  {
    type: "open_url", category: "Actions", label: "Open link", icon: ExternalLink, channels: WEB,
    description: "Send a button that opens a web page, an email or any link.",
    bg: "#f0f9ff", border: "#38bdf8", text: "#075985", badge: "#e0f2fe",
    emptyContent: { body: "", button_text: "Open", url: "" },
  },
  {
    type: "message_shop", category: "Actions", label: "Shop", icon: ShoppingCart, channels: BOTH,
    description: "Send a link to your product catalog — customer browses, orders and pays, then returns to chat.",
    webDescription: "Send a link to your product catalog so visitors can browse it (checkout happens on WhatsApp).",
    bg: "#f0fdf4", border: "#4ade80", text: "#14532d", badge: "#dcfce7",
    emptyContent: { body: "Browse our menu and add items to your cart 🛒\nSelect multiple items at once", button_text: "View Menu", catalog_id: "" },
  },
  {
    type: "message_booking", category: "Actions", label: "Booking", icon: CalendarDays, channels: BOTH,
    description: "Send a link to book an appointment from your Appointments calendar.",
    bg: "#eef2ff", border: "#818cf8", text: "#3730a3", badge: "#e0e7ff",
    emptyContent: { body: "Book your appointment 📅\nChoose a date and time that works for you.", button_text: "Book Appointment" },
  },
  {
    type: "message_event", category: "Actions", label: "Event Registration", icon: CalendarPlus, channels: BOTH,
    description: "Send a registration card for one of your events, with a Register Now button.",
    bg: "#fdf2f8", border: "#f9a8d4", text: "#831843", badge: "#fce7f3",
    emptyContent: { body: "", event_id: "", button_text: "Register Now", banner_url: "", contact_phone: "" },
  },
  {
    type: "time_delay", category: "Logic", label: "Time Delay", icon: Clock, channels: BOTH,
    description: "Wait a set amount of time before continuing to the next node.",
    bg: "#f8fafc", border: "#94a3b8", text: "#334155", badge: "#f1f5f9",
    emptyContent: { delay_seconds: 60, delay_unit: "seconds" },
    webEmptyContent: { delay_seconds: 3, delay_unit: "seconds" },
  },
  {
    type: "condition", advanced: true, category: "Logic", label: "Condition", icon: GitBranch, channels: WEB,
    description: "Branch on an answer: e.g. budget greater than 50, city is Chennai. Anything else goes to Else.",
    bg: "#f5f3ff", border: "#a78bfa", text: "#4c1d95", badge: "#ede9fe",
    emptyContent: { rules: [{ name: "", match: "all", rows: [{ var: "", op: "equals", value: "" }] }] },
  },
  {
    type: "set_variable", advanced: true, category: "Logic", label: "Set variable", icon: Variable, channels: WEB,
    description: "Store a value (text or {{other variables}}) to use later in the flow.",
    bg: "#f8fafc", border: "#cbd5e1", text: "#1e293b", badge: "#f1f5f9",
    emptyContent: { assignments: [{ var: "", value: "" }] },
  },
  {
    type: "random_split", advanced: true, category: "Logic", label: "Random split", icon: Shuffle, channels: WEB,
    description: "Send visitors down different paths at random (A/B test two welcome messages).",
    bg: "#fff7ed", border: "#fb923c", text: "#7c2d12", badge: "#ffedd5",
    emptyContent: { branches: [{ label: "A", weight: 50 }, { label: "B", weight: 50 }] },
  },
  {
    type: "back_to_menu", category: "Logic", label: "Back to Menu", icon: CornerUpLeft, channels: BOTH,
    description: "Restart this flow from its start node.",
    bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#dcfce7",
    emptyContent: { body: "" },
  },
  {
    type: "end", category: "Logic", label: "End", icon: CircleStop, channels: WEB,
    description: "Finish the flow, optionally with a closing message.",
    bg: "#f8fafc", border: "#94a3b8", text: "#334155", badge: "#f1f5f9",
    emptyContent: { body: "" },
  },
  {
    type: "webhook", advanced: true, category: "Integrations", label: "Webhook", icon: Webhook, channels: WEB,
    description: "Send answers to your own system (CRM, sheet, API) and use its reply. Has Success and Failure paths.",
    bg: "#f0fdfa", border: "#5eead4", text: "#134e4a", badge: "#ccfbf1",
    emptyContent: { method: "POST", url: "", headers: [], body: [], include_all_vars: false, mappings: [], waiting_text: "" },
  },
  {
    type: "ask_a_question", category: "AI & Handoff", label: "Ask AI", icon: Sparkles, channels: BOTH,
    description: "Hand the conversation to AI — the customer can ask anything, answered from your documents.",
    bg: "#fffbeb", border: "#fcd34d", text: "#78350f", badge: "#fef3c7",
    emptyContent: { body: "You can now ask me anything!" },
  },
  {
    type: "talk_to_human", category: "AI & Handoff", label: "Talk to Human", icon: Headset, channels: BOTH,
    description: "Hand the conversation to your team and stop automated replies.",
    bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", badge: "#fee2e2",
    emptyContent: { body: "Connecting you to our team. Please wait..." },
  },
];

export const NODE_BY_TYPE = Object.fromEntries(NODE_REGISTRY.map(n => [n.type, n]));

export function canonicalType(type) {
  return LEGACY_ALIASES[type] || type;
}

export const optionId = sharedOptionId;
export const newOptionId = sharedNewOptionId;

// Registry entry for RENDERING an existing node — covers canonical types,
// legacy aliases (mapped through), and the two render-only legacy types.
export function nodeInfo(type) {
  return NODE_BY_TYPE[canonicalType(type)] || RENDER_ONLY_TYPES[type] || NODE_BY_TYPE.message;
}

// Advanced nodes (condition, set variable, random split, webhook) are kept
// out of the Add Node panel for now: most merchants found them confusing.
// The engine still runs them, so a flow that already has one keeps working
// and still shows and edits it; set SHOW_ADVANCED_NODES to offer them again.
export const SHOW_ADVANCED_NODES = false;

export function nodesForChannel(channel) {
  return NODE_REGISTRY.filter(n =>
    n.channels.includes(channel || "whatsapp") && (SHOW_ADVANCED_NODES || !n.advanced));
}

// Website options get stable ids so a renamed chip keeps its connection.
// WhatsApp content is left exactly as before (its ids come from labels).
function withIds(type, content) {
  const c = JSON.parse(JSON.stringify(content || {}));
  const tag = (list, prefix) => (list || []).forEach(o => { if (!o.id) o.id = newOptionId(prefix); });
  if (type === "message_buttons") tag(c.buttons, "o");
  if (type === "quick_replies") tag(c.options, "o");
  if (type === "message_list") (c.sections || []).forEach(s => tag(s.rows, "o"));
  if (type === "carousel") (c.cards || []).forEach(card => tag(card.buttons, "c"));
  if (type === "condition") tag(c.rules, "r");
  if (type === "random_split") tag(c.branches, "b");
  return c;
}

export function emptyContentFor(type, channel = "whatsapp") {
  const entry = NODE_BY_TYPE[type];
  if (!entry) return {};
  if (channel === "web") return withIds(type, entry.webEmptyContent || entry.emptyContent);
  return JSON.parse(JSON.stringify(entry.emptyContent || {}));
}
