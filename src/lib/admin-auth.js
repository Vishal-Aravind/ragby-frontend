// lib/admin-auth.js
// Staff auth + audit logging for the internal admin panel. Mirrors the
// getProjectRole pattern in supabase-api.js: service-role client to read
// staff_roles (bypassing RLS deliberately — this only checks membership,
// never exposes tenant content), an explicit check per request rather
// than relying on RLS as a safety net.

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Uses getUser() rather than getSession() — getSession() reads the JWT
// straight out of the cookie without revalidating against the Auth
// server, which is exactly the unsafe pattern the old admin route used
// as its only authorization check. getUser() re-validates on every call.
export async function requireStaff(supabase) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: staff } = await supabaseAdmin
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staff) return null;
  return { user, role: staff.role };
}

export async function logAdminAction(staffUserId, action, targetType, targetId, metadata = {}) {
  await supabaseAdmin.from("admin_audit_log").insert({
    staff_user_id: staffUserId,
    action,
    target_type: targetType,
    target_id: targetId ? String(targetId) : null,
    metadata,
  });
}

export { supabaseAdmin };
