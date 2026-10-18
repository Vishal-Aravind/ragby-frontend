"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Image as ImageIcon, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadMedia } from "@/lib/uploadMedia";

// Same allow-list as FOLDER_RULES["shop-branding"] in /api/storage/upload
// and the backend's valid_media_url (no GIF / SVG).
const ALLOWED_EXT = ["png", "jpg", "jpeg", "webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function checkImageFile(file) {
  const ext = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXT.includes(ext)) return "Use a PNG, JPG or WEBP image.";
  if (file.size > MAX_BYTES) return "That image is over 5 MB. Please use a smaller one.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

// Image picker with preview + Upload / Replace / Remove.
//   value     current URL or ""/null
//   onChange  (url | null) => void | Promise — called after a successful
//             upload, or with null on Remove. If it returns a promise the
//             field stays busy until it settles.
//   aspect    CSS aspect-ratio for the preview ("3 / 1", "16 / 9", "1 / 1")
//   round     circular preview (logo)
export default function ImageUploadField({
  label, hint, value, onChange, aspect = "16 / 9", round = false,
  folder = "shop-branding", disabled = false, previewClassName = "",
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = () => { if (!disabled && !busy) inputRef.current?.click(); };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = checkImageFile(file);
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    try {
      const { url, error } = await uploadMedia(file, folder);
      if (!url) { toast.error(error || "Upload failed. Try again."); return; }
      await onChange?.(url);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try { await onChange?.(null); } finally { setBusy(false); }
  };

  const shape = round ? "rounded-full" : "rounded-lg";

  return (
    <div className="space-y-2">
      {label && <label className="text-xs text-gray-500 block">{label}</label>}
      <div className="flex items-start gap-3 flex-wrap">
        <button type="button" onClick={pick} disabled={disabled || busy}
          aria-label={value ? `Replace ${label || "image"}` : `Upload ${label || "image"}`}
          style={{ aspectRatio: aspect }}
          className={`relative overflow-hidden border bg-gray-50 flex items-center justify-center shrink-0 ${shape} ${
            value ? "" : "border-dashed border-2"
          } ${disabled ? "cursor-default" : "cursor-pointer hover:bg-gray-100"} ${previewClassName || (round ? "w-24" : "w-full max-w-sm")}`}>
          {value ? (
            <img src={value} alt={label || "image"} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <span className="flex flex-col items-center text-gray-300">
              <ImageIcon size={20} />
              {!round && <span className="text-[11px] text-gray-400 mt-1">PNG, JPG, WEBP · max 5 MB</span>}
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-gray-500" />
            </span>
          )}
        </button>
        {!disabled && (
          <div className="flex flex-col gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={pick} disabled={busy}>
              <Upload size={12} className="mr-1" /> {value ? "Replace" : "Upload"}
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={busy}
                className="text-red-500 hover:text-red-600 hover:bg-red-50">
                <Trash2 size={12} className="mr-1" /> Remove
              </Button>
            )}
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}
