// app/api/files/[fileId]/route.js

import { NextResponse } from "next/server";
import { getSupabase, getProjectRole } from "@/lib/supabase-api";

export async function DELETE(req, { params }) {
  const { fileId } = await params; // FIX: await params in Next.js 15

  const { supabase } = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: file, error } = await supabase
    .from("files")
    .select("id, storage_path, project_id")
    .eq("id", fileId)
    .single();

  if (error || !file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Scoped by project role rather than uploader — same reasoning as the
  // list route. 404 (not 403) so this can't be used to probe which file
  // ids exist in other projects.
  const role = await getProjectRole(user.id, file.project_id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Vectors FIRST. This endpoint purges Qdrant and deletes the row, so if
  // it fails nothing has been removed and the user can retry. The previous
  // order deleted the file and its row up front and ignored this response,
  // so a backend outage made the document vanish from the UI while its
  // chunks kept being retrieved and cited by the bot, unreachable forever.
  const res = await fetch(`${process.env.BACKEND_BASE_URL}/document/${fileId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${session.access_token}` },
  });

  if (!res.ok) {
    console.error("document delete failed:", res.status, await res.text());
    return NextResponse.json(
      { error: "Couldn't delete this document. Please try again." },
      { status: 502 }
    );
  }

  // Only once the indexed content is gone do we drop the stored object.
  // A failure here leaves an orphaned file in storage but nothing the bot
  // can answer from, which is the safe direction to fail.
  if (file.storage_path) {
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([file.storage_path]);
    if (storageError) console.error("storage cleanup failed:", storageError);
  }

  return NextResponse.json({ success: true });
}
