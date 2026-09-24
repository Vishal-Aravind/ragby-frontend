// app/api/files/upload/route.js
//
// Step 2 of a two-step upload — see /api/files/upload-url for step 1 and
// why the file's bytes never come through this route (or any Next.js API
// route) anymore. By the time this runs, the browser has already put the
// file directly into Supabase Storage; this just confirms that happened,
// records it, and kicks off ingestion.

import { NextResponse } from "next/server";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";
import { safeFilename, DOCUMENT_EXTENSIONS } from "@/lib/safe-filename";

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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const projectId = body?.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const role = await getProjectRole(user.id, projectId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const filename = safeFilename(body?.filename);
  if (!filename) {
    return NextResponse.json({ error: "Invalid file name." }, { status: 400 });
  }

  const ext = filename.toLowerCase().split(".").pop();
  if (!DOCUMENT_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: "That file type isn't supported. Upload a PDF, Word, PowerPoint, Excel or text file." },
      { status: 400 }
    );
  }

  // The path this route trusts is recomputed from projectId + filename,
  // exactly like /api/files/upload-url does — never taken from the
  // client's own claimed `path`, so a caller can't point this at a
  // storage object outside their own project's prefix.
  const path = `${projectId}/${filename}`;

  // Confirm the object actually exists before trusting it — a client
  // could call this route without ever having uploaded anything.
  const { data: exists, error: listError } = await supabase.storage
    .from("documents")
    .list(projectId, { search: filename });

  if (listError || !exists?.some((f) => f.name === filename)) {
    return NextResponse.json(
      { error: "Upload did not complete. Please try again." },
      { status: 400 }
    );
  }

  // Upsert file record in DB
  const { data: fileRow, error: dbError } = await supabase
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
    )
    .select("id")
    .single();

  if (dbError) {
    console.error("files upsert failed:", dbError);
    await supabase.storage.from("documents").remove([path]);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  // Call FastAPI ingest with auth token
  const ingestRes = await fetch(`${process.env.BACKEND_BASE_URL}/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
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

    // Plan limits (403) and throttling (429) are the user's own situation
    // and are worth stating plainly — unlike an internal failure, there's
    // something they can actually do about it.
    let message = "Uploaded, but we couldn't read the contents. Try re-uploading it.";
    if (ingestRes.status === 403 || ingestRes.status === 429) {
      try {
        const parsed = JSON.parse(detail);
        if (parsed?.detail) message = parsed.detail;
      } catch {
        // fall through to the generic message
      }
    }

    return NextResponse.json(
      { success: false, status: "failed", error: message, id: fileRow.id },
      { status: ingestRes.status === 429 ? 429 : 502 }
    );
  }

  return NextResponse.json({ success: true, status: "indexed", id: fileRow.id });
}
