//app/api/files/route.js

import { NextResponse } from "next/server";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";

export async function GET(req) {
  const { supabase } = getSupabase(req);
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Documents belong to the PROJECT, not to whoever happened to upload
  // them. Filtering by user_id meant an owner couldn't see (or clean up)
  // a teammate's uploads that their own bot was answering from.
  const role = await getProjectRole(user.id, projectId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("files")
    .select("id, filename, status, updated_at")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("files list error:", error);
    return NextResponse.json({ error: "Could not load documents." }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
