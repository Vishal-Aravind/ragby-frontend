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
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25MB
