// src/app/api/storage/upload/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ALLOWED_BUCKETS = ["flow-media"];

const IMAGE_TYPES = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp",
};
const VIDEO_TYPES = {
  mp4: "video/mp4", "3gp": "video/3gpp", mov: "video/quicktime", webm: "video/webm",
};
const AUDIO_TYPES = {
  mp3: "audio/mpeg", ogg: "audio/ogg", aac: "audio/aac", m4a: "audio/mp4",
};
const DOC_TYPES = {
  pdf: "application/pdf", txt: "text/plain", csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

// Keys match the `folder` values the real callers send: the four WhatsApp
// flow node types (FlowsTab's MEDIA_CONFIG), ShopTab's product images, and
// PageBuilder's event pages. Limits mirror the client-side ones so the two
// can't disagree. Adding a new upload surface means adding a key here.
const FOLDER_RULES = {
  message_media:    { limit: 5 * 1024 * 1024,   types: IMAGE_TYPES },
  message_video:    { limit: 16 * 1024 * 1024,  types: VIDEO_TYPES },
  message_audio:    { limit: 16 * 1024 * 1024,  types: AUDIO_TYPES },
  message_document: { limit: 100 * 1024 * 1024, types: DOC_TYPES },
  products:         { limit: 5 * 1024 * 1024,   types: IMAGE_TYPES },
  "event-pages":    { limit: 5 * 1024 * 1024,   types: IMAGE_TYPES },
};

export async function POST(req) {
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => response.cookies.set({ name, value, ...options }),
        remove: (name, options) => response.cookies.set({ name, value: "", ...options }),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file     = formData.get("file");
  const bucket   = formData.get("bucket") || "flow-media";
  const folder   = formData.get("folder") || "misc";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // bucket and folder came straight from the request body and were
  // interpolated into the storage key, so a caller could pick any bucket
  // (including `documents`), escape the prefix with "..", and choose which
  // size cap applied to them. Both are now allowlisted.
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: "Invalid upload target." }, { status: 400 });
  }
  if (!Object.prototype.hasOwnProperty.call(FOLDER_RULES, folder)) {
    return NextResponse.json({ error: "Invalid upload target." }, { status: 400 });
  }

  const rules = FOLDER_RULES[folder];
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > rules.limit) {
    return NextResponse.json({ error: `File too large. Max ${rules.limit / 1024 / 1024}MB allowed.` }, { status: 400 });
  }

  // The extension drives the stored content type. Trusting the browser's
  // file.type let a caller store text/html or SVG and then hand the
  // resulting public URL to a victim — stored XSS on our own origin.
  const ext = String(file.name).split(".").pop()?.toLowerCase() || "";
  const contentType = rules.types[ext];
  if (!contentType) {
    return NextResponse.json({ error: "That file type isn't supported here." }, { status: 400 });
  }

  const filename = `${user.id}/${folder}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer      = Buffer.from(arrayBuffer);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    console.error("Storage upload failed:", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);

  return NextResponse.json({ url: publicUrl, path: filename });
}