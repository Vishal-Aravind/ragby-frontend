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

  const existingObject = exists?.find((f) => f.name === filename);
  if (listError || !existingObject) {
    return NextResponse.json(
      { error: "Upload did not complete. Please try again." },
      { status: 400 }
    );
  }

  // Deliberately NOT existingObject.metadata?.size. That first attempt
  // re-queried Storage's own list() for the size to expect, but that read
  // is subject to the exact same overwrite-propagation lag as the download
  // it was meant to catch — on the first save after an edit, both landed
  // on the same stale replica, so the check passed immediately against
  // stale data and only started working on a second save once the lag had
  // cleared. The browser's own File object's size is known before any
  // round trip to Storage at all, so it can't be stale the same way.
  const expectedBytes = typeof body?.fileSize === "number" ? body.fileSize : null;

  // Set explicitly (not just when true) so re-saving an edited note keeps
  // is_note true, and a same-named regular upload can't leave a stale true
  // behind from an unrelated previous row.
  const isNote = !!body?.isNote;

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
        is_note: isNote,
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
    body: JSON.stringify({ projectId, filename, filePath: path, expectedBytes }),
  });

  // Previously this returned {success:true} unconditionally, so the UI
  // marked every file "Indexed" even when ingestion had failed outright —
  // the user believed the document was in the knowledge base when the bot
  // had nothing. The file stays uploaded so it can be retried.
  if (!ingestRes.ok) {
    const detail = await ingestRes.text();
    console.error("Ingest failed:", ingestRes.status, detail);

    // Every 4xx from ingest (unsupported type, unreadable/corrupt file, plan
    // limit, rate limit) is the caller's own situation, with a specific
    // message the backend already wrote for exactly this case — passing it
    // through beats a generic one. It was being discarded and remapped to a
    // flat 502 for anything other than 403/429, so a renamed .zip uploaded
    // as "document.pdf" showed the same "server error" wording and status
    // as an actual OpenAI/Qdrant/Supabase outage, which it isn't.
    let message = "Uploaded, but we couldn't read the contents. Try re-uploading it.";
    if (ingestRes.status >= 400 && ingestRes.status < 500) {
      try {
        const parsed = JSON.parse(detail);
        if (parsed?.detail) message = parsed.detail;
      } catch {
        // fall through to the generic message
      }
    }

    const status = ingestRes.status >= 400 && ingestRes.status < 500 ? ingestRes.status : 502;
    return NextResponse.json(
      { success: false, status: "failed", error: message, id: fileRow.id },
      { status }
    );
  }

  return NextResponse.json({ success: true, status: "indexed", id: fileRow.id });
}
