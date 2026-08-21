import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { requireStaff, supabaseAdmin } from "@/lib/admin-auth";

const PAGE_SIZE = 25;

// Strip characters that have special meaning inside a PostgREST .or()/.ilike
// filter string (comma separates conditions, parens group them) so a search
// term can't reshape the query we're building.
function sanitizeSearch(q) {
  return (q || "").replace(/[,()]/g, "").trim().slice(0, 100);
}

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const staff = await requireStaff(supabase);
  if (!staff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = sanitizeSearch(searchParams.get("q"));
  const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10));
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let projectIdFilter = null;
  if (q) {
    const { data: matchingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .or(`email.ilike.%${q}%,name.ilike.%${q}%`);
    const ownerIds = (matchingProfiles || []).map(p => p.id);

    let query = supabaseAdmin.from("projects").select("id").ilike("name", `%${q}%`);
    const { data: nameMatches } = await query;
    const nameMatchIds = (nameMatches || []).map(p => p.id);

    if (ownerIds.length === 0 && nameMatchIds.length === 0) {
      return NextResponse.json({ tenants: [], page, hasMore: false });
    }

    let ownerMatchIds = [];
    if (ownerIds.length > 0) {
      const { data: ownerProjects } = await supabaseAdmin
        .from("projects")
        .select("id")
        .in("user_id", ownerIds);
      ownerMatchIds = (ownerProjects || []).map(p => p.id);
    }

    projectIdFilter = [...new Set([...nameMatchIds, ...ownerMatchIds])];
    if (projectIdFilter.length === 0) {
      return NextResponse.json({ tenants: [], page, hasMore: false });
    }
  }

  let projectsQuery = supabaseAdmin
    .from("projects")
    .select("id, name, user_id, suspended, created_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (projectIdFilter) projectsQuery = projectsQuery.in("id", projectIdFilter);

  const { data: projects, error } = await projectsQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ownerIds = [...new Set((projects || []).map(p => p.user_id))];
  const month = new Date().toISOString().slice(0, 7);

  const [profilesRes, usageRes, membersRes] = await Promise.all([
    ownerIds.length
      ? supabaseAdmin.from("profiles").select("id, name, email, plan").in("id", ownerIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length
      ? supabaseAdmin.from("usage").select("user_id, count").eq("month", month).in("user_id", ownerIds)
      : Promise.resolve({ data: [] }),
    (projects || []).length
      ? supabaseAdmin.from("project_members").select("project_id").eq("status", "active").in("project_id", (projects || []).map(p => p.id))
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = {};
  (profilesRes.data || []).forEach(p => { profileMap[p.id] = p; });
  const usageMap = {};
  (usageRes.data || []).forEach(u => { usageMap[u.user_id] = u.count; });
  const memberCountMap = {};
  (membersRes.data || []).forEach(m => { memberCountMap[m.project_id] = (memberCountMap[m.project_id] || 0) + 1; });

  const tenants = (projects || []).map(p => ({
    ...p,
    owner: profileMap[p.user_id] || null,
    usageThisMonth: usageMap[p.user_id] || 0,
    teamSize: 1 + (memberCountMap[p.id] || 0),
  }));

  return NextResponse.json({ tenants, page, hasMore: (projects || []).length === PAGE_SIZE });
}
