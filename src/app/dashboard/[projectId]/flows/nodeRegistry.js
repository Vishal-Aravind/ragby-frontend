// nodeRegistry.js
//
// Single source of truth for every flow node type — what it's called, what
// it does, which category it sits under in the Add Node panel, its default
// content, and its color. Previously this lived split across two separate
// lists (a message-type dropdown rendered INSIDE each node, and a "special
// nodes" drag sidebar) that didn't overlap and neither explained what the
// other's node types did. One registry closes both gaps at once, and is
// also where a node type actually gets exposed in the UI — message_event
// existed end-to-end in backend/flows.py but was never added to either old
// list, so Registrations had no way to be triggered from a flow at all.
import {
  MessageSquare, SquareMousePointer, ListChecks, Image, Video, FileText,
  Music, MapPin, User, PhoneCall, ShoppingCart, CalendarDays, CalendarPlus,
  Clock, CornerUpLeft, Sparkles, Headset,
} from "lucide-react";

export const CATEGORIES = ["Messages", "Interactive", "Actions", "Logic", "AI & Handoff"];

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

export const NODE_REGISTRY = [
  {
    type: "message", category: "Messages", label: "Message", icon: MessageSquare,
    description: "Send a plain text message.",
    bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#dcfce7",
    emptyContent: { body: "" },
  },
  {
    type: "message_media", category: "Messages", label: "Image", icon: Image,
    description: "Send a message with an image attached.",
    bg: "#fff7ed", border: "#fdba74", text: "#9a3412", badge: "#ffedd5",
    emptyContent: { body: "", media_url: "" },
  },
  {
    type: "message_video", category: "Messages", label: "Video", icon: Video,
    description: "Send a message with a video attached.",
    bg: "#fdf4ff", border: "#e879f9", text: "#86198f", badge: "#fae8ff",
    emptyContent: { body: "", video_url: "" },
  },
  {
    type: "message_document", category: "Messages", label: "Document", icon: FileText,
    description: "Send a PDF, Word, Excel or other file.",
    bg: "#f0f9ff", border: "#7dd3fc", text: "#0c4a6e", badge: "#e0f2fe",
    emptyContent: { body: "", document_url: "", filename: "" },
  },
  {
    type: "message_audio", category: "Messages", label: "Audio", icon: Music,
    description: "Send a voice note or audio clip.",
    bg: "#fdf4ff", border: "#d946ef", text: "#701a75", badge: "#fae8ff",
    emptyContent: { body: "", audio_url: "" },
  },
  {
    type: "message_location", category: "Messages", label: "Location", icon: MapPin,
    description: "Send a pin the customer can open in Maps.",
    bg: "#f0fdf4", border: "#4ade80", text: "#14532d", badge: "#dcfce7",
    emptyContent: { body: "", latitude: "", longitude: "", name: "", address: "" },
  },
  {
    type: "message_contact", category: "Messages", label: "Contact", icon: User,
    description: "Send a WhatsApp contact card.",
    bg: "#fafafa", border: "#a1a1aa", text: "#18181b", badge: "#f4f4f5",
    emptyContent: { body: "", contact_name: "", contact_phone: "" },
  },
  {
    type: "message_buttons", category: "Interactive", label: "Buttons", icon: SquareMousePointer,
    description: "Ask a question with up to 3 tappable buttons, each leading somewhere different.",
    bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", badge: "#dbeafe",
    emptyContent: { body: "", buttons: [{ label: "Option 1" }, { label: "Option 2" }] },
  },
  {
    type: "message_list", category: "Interactive", label: "List", icon: ListChecks,
    description: "Ask a question with a scrollable list of options, grouped into sections.",
    bg: "#faf5ff", border: "#c4b5fd", text: "#5b21b6", badge: "#ede9fe",
    emptyContent: { body: "", button_text: "View Options", sections: [{ title: "", rows: [{ label: "Option 1" }, { label: "Option 2" }] }] },
  },
  {
    type: "call_us", category: "Actions", label: "Call Us", icon: PhoneCall,
    description: "Send a button that opens the customer's phone dialer.",
    bg: "#fff7ed", border: "#fdba74", text: "#9a3412", badge: "#ffedd5",
    emptyContent: { body: "Need help? Call us directly!", phone: "" },
  },
  {
    type: "message_shop", category: "Actions", label: "Shop", icon: ShoppingCart,
    description: "Send a link to your product catalog — customer browses, orders and pays, then returns to chat.",
    bg: "#f0fdf4", border: "#4ade80", text: "#14532d", badge: "#dcfce7",
    emptyContent: { body: "Browse our menu and add items to your cart 🛒\nSelect multiple items at once", button_text: "View Menu", catalog_id: "" },
  },
  {
    type: "message_booking", category: "Actions", label: "Booking", icon: CalendarDays,
    description: "Send a link to book an appointment from your Appointments calendar.",
    bg: "#eef2ff", border: "#818cf8", text: "#3730a3", badge: "#e0e7ff",
    emptyContent: { body: "Book your appointment 📅\nChoose a date and time that works for you.", button_text: "Book Appointment" },
  },
  {
    type: "message_event", category: "Actions", label: "Event Registration", icon: CalendarPlus,
    description: "Send a registration card for one of your events, with a Register Now button.",
    bg: "#fdf2f8", border: "#f9a8d4", text: "#831843", badge: "#fce7f3",
    emptyContent: { body: "", event_id: "", button_text: "Register Now", banner_url: "", contact_phone: "" },
  },
  {
    type: "time_delay", category: "Logic", label: "Time Delay", icon: Clock,
    description: "Wait a set amount of time before continuing to the next node.",
    bg: "#f8fafc", border: "#94a3b8", text: "#334155", badge: "#f1f5f9",
    emptyContent: { delay_seconds: 60, delay_unit: "seconds" },
  },
  {
    type: "back_to_menu", category: "Logic", label: "Back to Menu", icon: CornerUpLeft,
    description: "Restart this flow from its start node.",
    bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#dcfce7",
    emptyContent: { body: "" },
  },
  {
    type: "ask_a_question", category: "AI & Handoff", label: "Ask a Question", icon: Sparkles,
    description: "Hand the conversation to AI — the customer can ask anything, answered from your documents.",
    bg: "#fffbeb", border: "#fcd34d", text: "#78350f", badge: "#fef3c7",
    emptyContent: { body: "You can now ask me anything!" },
  },
  {
    type: "talk_to_human", category: "AI & Handoff", label: "Talk to Human", icon: Headset,
    description: "Hand the conversation to your team and stop automated replies.",
    bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", badge: "#fee2e2",
    emptyContent: { body: "Connecting you to our team. Please wait..." },
  },
];

export const NODE_BY_TYPE = Object.fromEntries(NODE_REGISTRY.map(n => [n.type, n]));

export function canonicalType(type) {
  return LEGACY_ALIASES[type] || type;
}

// Registry entry for RENDERING an existing node — covers canonical types,
// legacy aliases (mapped through), and the two render-only legacy types.
export function nodeInfo(type) {
  return NODE_BY_TYPE[canonicalType(type)] || RENDER_ONLY_TYPES[type] || NODE_BY_TYPE.message;
}

export function emptyContentFor(type) {
  return NODE_BY_TYPE[type]?.emptyContent || {};
}
