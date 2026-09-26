// app/api/files/upload-url/route.js
//
// Step 1 of a two-step upload. Vercel serverless functions reject any
// request body over ~4.5MB (FUNCTION_PAYLOAD_TOO_LARGE) regardless of
// what our own code allows — a file's bytes can never survive a POST to
// a Next.js API route once it's past a few MB. So the actual bytes go
// straight from the browser to Supabase Storage using a short-lived
// signed upload URL; this route only ever sees a filename and a project
// id, never the file itself.
//
// The bucket's own file_size_limit (see MAX_DOCUMENT_BYTES's comment at
// the call site) is still the absolute outer ceiling no plan can exceed.
// This route additionally enforces the tighter, PLAN-AWARE ceiling before
// ever issuing a signed URL — the client already reports the file's size
// (fileSize) before any bytes move, so a free-plan upload past its limit
// fails fast here instead of only being caught after the fact in ingest.py.

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSupabase, getProjectRole, getToken } from "@/lib/supabase-api";
import { proxyToBackend } from "@/lib/backend-proxy";
import { safeFilename, DOCUMENT_EXTENSIONS } from "@/lib/safe-filename";

export async function POST(req) {
  const { supabase } = getSupabase(req);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // fileSize is the browser's own File.size, reported before any bytes
  // move — lets an over-limit upload fail here instead of only being
  // caught after the fact in ingest.py. Optional: an older client that
  // doesn't send it just skips this fast-fail and relies on the backstop.
  const fileSize = typeof body?.fileSize === "number" ? body.fileSize : null;
  if (fileSize !== null) {
    const token = await getToken(supabase);
    const limitsRes = await proxyToBackend(`/projects/${projectId}/limits`, { token });
    const limitsData = await limitsRes.json().catch(() => ({}));
    const maxFileMB = limitsData?.maxFileMB;
    if (typeof maxFileMB === "number" && fileSize > maxFileMB * 1024 * 1024) {
      return NextResponse.json(
        {
          error: `This file is too large for your plan (limit ${maxFileMB}MB). Upgrade your plan to upload larger files.`,
        },
        { status: 413 }
      );
    }
  }

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

  // A fresh, never-before-used key per upload — deliberately NOT
  // `${projectId}/${filename}` reused across re-uploads/edits. Retrying a
  // download against a byte-count we expect, right after overwriting an
  // EXISTING key, turned out to still lose the race against Supabase
  // Storage's own overwrite-propagation delay in real testing even with
  // several seconds of backoff. A brand-new key has no previous version
  // to race against — new-object read-after-write is a much simpler
  // guarantee every object store actually provides. The confirm route
  // swaps the DB row's storage_path to this new key and only deletes the
  // old physical object once the new one is confirmed ingested.
  const path = `${projectId}/${randomUUID()}-${filename}`;

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUploadUrl(path);

  if (error) {
    console.error("createSignedUploadUrl failed:", error);
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path });
}
