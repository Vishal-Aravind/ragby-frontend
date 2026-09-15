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
// The real size limit now lives on the Storage bucket itself (see
// MAX_DOCUMENT_BYTES's comment at the call site) — this route cannot
// see the file's size before the browser uploads it, so it isn't the
// enforcement point for that.

import { NextResponse } from "next/server";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";
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

  const path = `${projectId}/${filename}`;

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUploadUrl(path, { upsert: true });

  if (error) {
    console.error("createSignedUploadUrl failed:", error);
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path });
}
