// lib/uploadMedia.js
import { supabase } from "@/lib/supabase";

// Uploads a file to Supabase Storage and returns { url } or { error }.
// /api/storage/upload checks login, rate limit, type and size, then returns
// a one-time signed URL; the file itself goes straight from the browser to
// Supabase, so Vercel's 4.5MB request-body cap never applies.
export async function uploadMedia(file, folder, bucket = "flow-media") {
  try {
    const res = await fetch("/api/storage/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, folder, bucket }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "Upload failed. Try again." };

    const { error } = await supabase.storage
      .from(data.bucket)
      .uploadToSignedUrl(data.path, data.token, file, { contentType: data.contentType });
    if (error) return { error: "Upload failed. Try again." };

    return { url: data.url };
  } catch {
    return { error: "Upload failed. Try again." };
  }
}
