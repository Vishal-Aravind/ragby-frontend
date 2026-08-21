// app/api/files/upload/route.js

import { NextResponse } from "next/server";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";

export async function POST(req) {
  const { supabase } = getSupabase(req);

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user;
  const token = session.access_token; // FIX: get token to forward to FastAPI

  const formData = await req.formData();
  const file = formData.get("file");
  const projectId = formData.get("projectId");

  if (!file || !projectId) {
    return NextResponse.json({ error: "Missing file or projectId" }, { status: 400 });
  }

  // FIX: previously accepted any projectId with no ownership check — a
  // user could tag an upload to a project they don't own, triggering
  // ingestion into that project's knowledge base.
  const role = await getProjectRole(user.id, projectId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const path = `${projectId}/${file.name}`;

  // 1. Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // 2. Upsert file record in DB
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
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // 3. Call FastAPI ingest with auth token
  const ingestRes = await fetch(`${process.env.BACKEND_BASE_URL}/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`, // FIX: was missing, caused 401 on ingest
    },
    body: JSON.stringify({
      projectId,
      filename: file.name,
      filePath: path,
    }),
  });

  if (!ingestRes.ok) {
    const err = await ingestRes.text();
    console.error("Ingest failed:", err);
    // Don't block the response — file is uploaded, ingest can be retried
    // but log it so you can see failures
  }

  return NextResponse.json({ success: true });
}