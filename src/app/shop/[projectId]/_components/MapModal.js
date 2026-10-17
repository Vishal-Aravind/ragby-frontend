"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import LocationPickerMap from "@/components/shop/LocationPickerMap";

/**
 * Full-screen "pick a point" modal. Holds its own draft pin so cancelling
 * leaves the caller's value untouched; only "Confirm location" reports back.
 */
export default function MapModal({ open, title = "Pick your location", initial, center, markers, accent, onConfirm, onClose }) {
  const [draft, setDraft] = useState(initial || null);
  const [height, setHeight] = useState(420);

  useEffect(() => {
    if (open) setDraft(initial || null);
    // only when (re)opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fit = () => setHeight(Math.max(260, window.innerHeight - 170));
    fit();
    window.addEventListener("resize", fit);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", fit);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-bold text-gray-900 text-base">{title}</h2>
        <button onClick={onClose} aria-label="Close"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <X size={18} className="text-gray-600" />
        </button>
      </div>
      <div className="flex-1 p-3">
        <LocationPickerMap
          value={draft}
          onChange={setDraft}
          center={center || null}
          markers={markers || []}
          height={height}
          showLocateButton
        />
      </div>
      <div className="px-4 pb-5 pt-2 border-t bg-white">
        <p className="text-xs text-gray-500 mb-2 text-center">
          {draft ? "Drag the pin or tap the map to adjust." : "Tap the map or use “My location” to drop a pin."}
        </p>
        <button
          disabled={!draft}
          onClick={() => draft && onConfirm(draft)}
          className="w-full py-4 rounded-xl text-white font-semibold text-base disabled:opacity-50"
          style={{ background: accent }}
        >
          Confirm location
        </button>
      </div>
    </div>
  );
}
