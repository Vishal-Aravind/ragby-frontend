// app/api/files/upload/route.js

import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";

export async function POST(req) {
  const { supabase } = getSupabase(req);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const projectId = formData.get("projectId");

  if (!file || !projectId) {
    return NextResponse.json(
      { error: "Missing file or projectId" },
      { status: 400 }
    );
  }

  const path = `${projectId}/${file.name}`;

  // 1️⃣ Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    );
  }

  // 2️⃣ Upsert DB record
  const { error: dbError } = await supabase
    .from("files")
    .upsert(
      {
        project_id: projectId,
        user_id: user.id,
        filename: file.name,
        storage_path: path,
        status: "uploaded",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,filename" }
    );

  if (dbError) {
    return NextResponse.json(
      { error: dbError.message },
      { status: 500 }
    );
  }

  // 3️⃣ Call FastAPI ingest
  await fetch(`${process.env.BACKEND_BASE_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      filename: file.name,
      filePath: path,
    }),
  });

  return NextResponse.json({ success: true });
}
