// Reproduces the three distinct gating rules that used to live inline in
// ProjectClient.js's hasAccess() — not a lossy generalization of them:
//   - leads/conversations: no gate at all today
//   - team: owner/admin only, NOT a myPermissions key
//   - everything else: owner/admin, or an explicit myPermissions entry
const ALWAYS_ALLOWED = new Set(["leads", "conversations"]);
const OWNER_ADMIN_ONLY = new Set(["team"]);

export const ROLE_RANK = { agent: 1, admin: 2, owner: 3 };

// The single definition of the tab permission grid, in terms of the two
// things an API route can actually look up (see getProjectAccess in
// supabase-api.js). hasProjectTabAccess below is the UI's view of the same
// rules, and backend/auth.py's require_project_access is the Python mirror
// — all three must agree, so the rules live here exactly once.
export function roleHasTabAccess(role, permissions, tabKey) {
  if (!role) return false;
  const isOwnerOrAdmin = role === "owner" || role === "admin";

  if (ALWAYS_ALLOWED.has(tabKey)) return true;
  if (OWNER_ADMIN_ONLY.has(tabKey)) return isOwnerOrAdmin;
  if (isOwnerOrAdmin) return true;
  return (permissions || []).includes(tabKey);
}

export function hasProjectTabAccess(project, tabKey) {
  if (!project) return false;
  // Was `project.myRole || "owner"`, which failed OPEN: any project object
  // arriving without myRole (a shape change, a partially cached response)
  // silently granted owner-level access to every tab.
  return roleHasTabAccess(project.myRole, project.myPermissions, tabKey);
}

export function getDefaultTabSegment(project) {
  return hasProjectTabAccess(project, "documents") ? "documents" : "conversations";
}
