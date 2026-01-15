// app/api/files/[fileId]/route.js

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function DELETE(req, { params }) {
  const { supabase } = getSupabase(req);
  const { fileId } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1️⃣ Get file (ownership check)
  const { data: file, error } = await supabase
    .from("files")
    .select("id, storage_path, project_id")
    .eq("id", fileId)
    .eq("user_id", user.id)
    .single();

  if (error || !file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2️⃣ Delete from storage
  await supabase.storage
    .from("documents")
    .remove([file.storage_path]);

  // 3️⃣ Delete DB row
  await supabase.from("files").delete().eq("id", fileId);

  // 4️⃣ Notify FastAPI cleanup (optional but recommended)
  await fetch(`${process.env.BACKEND_BASE_URL}/document/${fileId}`, {
    method: "DELETE",
  });

  return NextResponse.json({ success: true });
}
