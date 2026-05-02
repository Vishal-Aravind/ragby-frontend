// ─────────────────────────────────────────────────────────
// app/api/chat/public/verify-password/route.js
// Checks if the entered password matches the project's chat_password
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
 
export async function POST(req) {
  const { projectId, password } = await req.json();
 
  const { data: project } = await supabase
    .from("projects")
    .select("chat_password")
    .eq("id", projectId)
    .single();
 
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
 
  if (project.chat_password !== password) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
 
  return NextResponse.json({ success: true });
}
 
