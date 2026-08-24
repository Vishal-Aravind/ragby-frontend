// Reproduces the three distinct gating rules that used to live inline in
// ProjectClient.js's hasAccess() — not a lossy generalization of them:
//   - leads/conversations: no gate at all today
//   - team: owner/admin only, NOT a myPermissions key
//   - everything else: owner/admin, or an explicit myPermissions entry
const ALWAYS_ALLOWED = new Set(["leads", "conversations"]);
const OWNER_ADMIN_ONLY = new Set(["team"]);

export function hasProjectTabAccess(project, tabKey) {
  if (!project) return false;
  const myRole = project.myRole || "owner";
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";

  if (ALWAYS_ALLOWED.has(tabKey)) return true;
  if (OWNER_ADMIN_ONLY.has(tabKey)) return isOwnerOrAdmin;
  if (isOwnerOrAdmin) return true;
  return (project.myPermissions || []).includes(tabKey);
}

export function getDefaultTabSegment(project) {
  return hasProjectTabAccess(project, "documents") ? "documents" : "conversations";
}
