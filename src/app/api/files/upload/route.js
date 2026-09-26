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

  // The exact path /api/files/upload-url generated and returned — this
  // route only ever trusts a path that WE issued, never one the client
  // could invent from scratch: createSignedUploadUrl's token is bound to
  // that exact path, so a client can only have a working upload at a path
  // this same server handed out. Still re-validated below (ownership
  // prefix + real existence), same defensive posture as the old
  // deterministic-recompute version.
  const path = typeof body?.path === "string" ? body.path : null;
  if (!path || !path.startsWith(`${projectId}/`)) {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
  }
  const basename = path.slice(projectId.length + 1);

  // Confirm the object actually exists before trusting it — a client
  // could call this route without ever having uploaded anything.
  const { data: exists, error: listError } = await supabase.storage
    .from("documents")
    .list(projectId, { search: basename });

  const existingObject = exists?.find((f) => f.name === basename);
  if (listError || !existingObject) {
    return NextResponse.json(
      { error: "Upload did not complete. Please try again." },
      { status: 400 }
    );
  }

  // The browser's own File object's size, known before any round trip to
  // Storage at all. Kept as a defensive check even though this path is now
  // brand-new every time (see upload-url's comment for why that alone
  // already avoids the overwrite-propagation race two earlier attempts at
  // this fix ran into).
  const expectedBytes = typeof body?.fileSize === "number" ? body.fileSize : null;

  // Set explicitly (not just when true) so re-saving an edited note keeps
  // is_note true, and a same-named regular upload can't leave a stale true
  // behind from an unrelated previous row.
  const isNote = !!body?.isNote;

  // Captured BEFORE the upsert below overwrites it, so the old physical
  // object can be cleaned up once — and only once — the new one is
  // confirmed successfully ingested.
  const { data: priorRow } = await supabase
    .from("files")
    .select("storage_path")
    .eq("project_id", projectId)
    .eq("filename", filename)
    .maybeSingle();
  const oldStoragePath = priorRow?.storage_path && priorRow.storage_path !== path
    ? priorRow.storage_path
    : null;

  // Upsert file record in DB, pointing at the NEW physical object
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

  // Call FastAPI ingest with auth token. Uncaught, this threw straight
  // through the route on a sleeping/unreachable backend, same bug class
  // fixed elsewhere in the sources routes via proxyToBackend — this route
  // has too much of its own DB/storage logic around it to switch to that
  // helper wholesale, so it just gets the same try/catch treatment inline.
  let ingestRes;
  try {
    ingestRes = await fetch(`${process.env.BACKEND_BASE_URL}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ projectId, filename, filePath: path, expectedBytes }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    console.error("ingest fetch failed:", e);
    return NextResponse.json(
      { success: false, status: "failed", error: "We couldn't reach the server. Please try again in a moment.", id: fileRow.id },
      { status: 502 }
    );
  }

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

  // Only now — the new object is confirmed successfully embedded — is the
  // OLD physical object (a prior upload or note edit under this same
  // filename) actually removed. Never deleted eagerly: if ingest above had
  // failed, the old object is left alone as an orphan rather than lost,
  // which is the safer direction to fail (a little unused storage beats
  // destroying the last known-good version of a document).
  if (oldStoragePath) {
    const { error: cleanupError } = await supabase.storage.from("documents").remove([oldStoragePath]);
    if (cleanupError) console.error("old storage object cleanup failed:", cleanupError);
  }

  // ingest's own body carries whether this file hit MAX_CHUNKS_PER_INGEST —
  // previously discarded here, so a 15,000-row spreadsheet silently lost
  // everything past row 3,000 with no signal anywhere the user could see.
  const ingestData = await ingestRes.json().catch(() => ({}));
  return NextResponse.json({
    success: true,
    status: "indexed",
    id: fileRow.id,
    truncated: !!ingestData.truncated,
    indexed_count: ingestData.indexed_count,
    total_count: ingestData.total_count,
  });
}
