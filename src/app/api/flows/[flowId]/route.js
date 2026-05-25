import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUser() {
  const cookieStore = cookies();
  const token = cookieStore.get("sb-access-token")?.value;
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

export async function PUT(req, { params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const update = {};
  if ("name" in body) update.name = body.name;
  if ("is_active" in body) update.is_active = body.is_active;
  if ("trigger_keywords" in body) update.trigger_keywords = body.trigger_keywords;

  // If activating, deactivate all others for same project
  if (body.is_active === true) {
    const flow = await supabase.table("flows").select("project_id").eq("id", params.flowId).single();
    if (flow.data) {
      await supabase.table("flows")
        .update({ is_active: false })
        .eq("project_id", flow.data.project_id)
        .neq("id", params.flowId);
    }
  }

  const res = await supabase.table("flows").update(update).eq("id", params.flowId).select().single();
  return NextResponse.json(res.data);
}

export async function DELETE(req, { params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.table("flows").delete().eq("id", params.flowId);
  return NextResponse.json({ status: "deleted" });
}