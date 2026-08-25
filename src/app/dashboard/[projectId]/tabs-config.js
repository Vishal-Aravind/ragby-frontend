import {
  FileText, Plug, Users, GitBranch, Inbox, BarChart2, Key,
  Megaphone, Sparkles, ShoppingBag, CalendarDays, CalendarRange, UserCog,
} from "lucide-react";

// The one place a 14th tab gets added: one object here + one route folder.
// `key` is the permission string (matches DB/TeamTab permission values,
// never rename it lightly). `segment` is the URL piece and can diverge
// freely from `key` for readability (see "api" -> "api-keys" below).
export const TAB_CONFIG = [
  { key: "documents",     segment: "documents",     label: "Documents",     icon: FileText,     tourId: "documents" },
  { key: "integrations",  segment: "integrations",  label: "Integrations",  icon: Plug,          tourId: "integrations" },
  { key: "leads",         segment: "leads",         label: "Leads",         icon: Users },
  { key: "flows",         segment: "flows",         label: "Flows",         icon: GitBranch,     tourId: "flows" },
  { key: "conversations", segment: "conversations", label: "Conversations", icon: Inbox,         tourId: "conversations" },
  { key: "analytics",     segment: "analytics",     label: "Analytics",     icon: BarChart2,     tourId: "analytics" },
  { key: "campaigns",     segment: "campaigns",     label: "Campaigns",     icon: Megaphone },
  { key: "templates",     segment: "templates",     label: "Templates",     icon: Sparkles },
  { key: "shop",          segment: "shop",          label: "Shop",          icon: ShoppingBag,   tourId: "shop" },
  { key: "appointments",  segment: "appointments",  label: "Appointments",  icon: CalendarDays },
  { key: "events",        segment: "events",        label: "Registrations", icon: CalendarRange },
  { key: "api",           segment: "api-keys",      label: "API",           icon: Key },
  { key: "team",          segment: "team",          label: "Team",          icon: UserCog },
];
