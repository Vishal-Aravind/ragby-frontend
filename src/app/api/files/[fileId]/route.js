// app/api/files/[fileId]/route.js

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function DELETE(req, { params }) {
  const { fileId } = await params; // FIX: await params in Next.js 15

  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ownership check
  const { data: file, error } = await supabase
    .from("files")
    .select("id, storage_path, project_id")
    .eq("id", fileId)
    .eq("user_id", user.id)
    .single();

  if (error || !file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete from storage
  await supabase.storage.from("documents").remove([file.storage_path]);

  // Delete DB row
  await supabase.from("files").delete().eq("id", fileId);

  // Delete from Qdrant via FastAPI
  const { data: { session } } = await supabase.auth.getSession();
  await fetch(`${process.env.BACKEND_BASE_URL}/document/${fileId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${session.access_token}` },
  });

  return NextResponse.json({ success: true });
}