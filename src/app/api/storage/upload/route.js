// src/app/api/storage/upload/route.js
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  // Size limits per type
  const sizeLimits = {
    message_media:    5  * 1024 * 1024,  // 5MB
    message_video:    16 * 1024 * 1024,  // 16MB
    message_document: 100 * 1024 * 1024, // 100MB
  };
  const limit = sizeLimits[folder] || 10 * 1024 * 1024;
  if (file.size > limit) {
    return NextResponse.json({ error: `File too large. Max ${limit / 1024 / 1024}MB allowed.` }, { status: 400 });
  }

  // Build unique path
  const ext      = file.name.split(".").pop();
  const filename = `${user.id}/${folder}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer      = Buffer.from(arrayBuffer);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType: file.type,
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