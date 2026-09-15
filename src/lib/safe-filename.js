// lib/safe-filename.js
//
// file.name is fully caller-controlled on a scripted multipart/JSON
// request — browsers strip directories, curl does not. Without this, a
// filename of "../<otherProjectId>/x.pdf" produced a storage key outside
// this project's prefix (and the backend's startswith() guard accepts
// ".." segments, so it passed there too). Shared by every route that
// turns a client-supplied name into a storage key.
export function safeFilename(name) {
  const base = String(name).split(/[\/]/).pop() || "";
  const cleaned = base
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/^\.+/, "")
    .trim();
  return cleaned.slice(0, 200);
}

export const DOCUMENT_EXTENSIONS = ["pdf", "docx", "ppt", "pptx", "xls", "xlsx", "txt"];
// 49MB — 1MB under the Supabase project's own 50MB plan-wide cap, which
// storage.buckets.file_size_limit (see the matching SQL update wherever
// this constant's value is changed) can never exceed regardless of what
// we set here.
export const MAX_DOCUMENT_BYTES = 49 * 1024 * 1024;
