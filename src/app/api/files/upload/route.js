// app/api/files/upload/route.js

import { NextResponse } from "next/server";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";

const ALLOWED_EXTENSIONS = ["pdf", "docx", "ppt", "pptx", "xls", "xlsx", "txt"];
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

// file.name is fully caller-controlled on a scripted multipart request —
// browsers strip directories, curl does not. Without this, a filename of
// "../<otherProjectId>/x.pdf" produced a storage key outside this
// project's prefix (and the backend's startswith() guard accepts ".."
// segments, so it passed there too).
function safeFilename(name) {
  const base = String(name).split(/[\/]/).pop() || "";
  const cleaned = base
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/^\.+/, "")
    .trim();
  return cleaned.slice(0, 200);
}

export async function POST(req) {
  const { supabase } = getSupabase(req);

  // getUser() revalidates against Supabase; getSession() only decodes the
  // cookie, and this user id is used for authorization below.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = session.access_token;

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

  const filename = safeFilename(file.name);
  if (!filename) {
    return NextResponse.json({ error: "Invalid file name." }, { status: 400 });
  }

  // Type and size were previously enforced only by the browser (an accept=
  // attribute and a client-side MIME list), i.e. not at all for a scripted
  // request. Extension-based, matching what the backend can actually parse.
  const ext = filename.toLowerCase().split(".").pop();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: "That file type isn't supported. Upload a PDF, Word, PowerPoint, Excel or text file." },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "That file is too large. The limit is 25MB." },
      { status: 400 }
    );
  }

  const path = `${projectId}/${filename}`;

  // 1. Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    console.error("storage upload failed:", uploadError);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  // 2. Upsert file record in DB
  const { error: dbError } = await supabase
    .from("files")
    .upsert(
      {
        project_id: projectId,
        user_id: user.id,
        filename,
        storage_path: path,
        status: "uploaded",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,filename" }
    );

  if (dbError) {
    console.error("files upsert failed:", dbError);
    await supabase.storage.from("documents").remove([path]);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  // 3. Call FastAPI ingest with auth token
  const ingestRes = await fetch(`${process.env.BACKEND_BASE_URL}/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`, // FIX: was missing, caused 401 on ingest
    },
    body: JSON.stringify({ projectId, filename, filePath: path }),
  });

  // Previously this returned {success:true} unconditionally, so the UI
  // marked every file "Indexed" even when ingestion had failed outright —
  // the user believed the document was in the knowledge base when the bot
  // had nothing. The file stays uploaded so it can be retried.
  if (!ingestRes.ok) {
    const detail = await ingestRes.text();
    console.error("Ingest failed:", ingestRes.status, detail);
    return NextResponse.json(
      {
        success: false,
        status: "failed",
        error: "Uploaded, but we couldn't read the contents. Try re-uploading it.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, status: "indexed" });
}
