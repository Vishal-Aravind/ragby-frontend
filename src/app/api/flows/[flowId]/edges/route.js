// ── src/app/api/flows/[flowId]/edges/route.js ─────────────
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

export async function POST(req, { params }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const res = await supabase.table("flow_edges").insert({
    flow_id: params.flowId,
    from_node_id: body.from_node_id,
    trigger: body.trigger,
    to_node_id: body.to_node_id,
  }).select().single();

  return NextResponse.json(res.data);
}


// ── src/app/api/flows/edges/[edgeId]/route.js ─────────────
// (separate file — shown here for reference)
// export async function DELETE(req, { params }) {
//   await supabase.table("flow_edges").delete().eq("id", params.edgeId);
//   return NextResponse.json({ status: "deleted" });
// }