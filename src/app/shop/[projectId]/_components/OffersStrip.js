"use client";

import { toast } from "sonner";
import { withAlpha } from "../_lib/shopApi";

/**
 * Horizontally scrolling offer chips under the header. Tapping a code chip
 * copies the code and remembers it, so Summary applies it automatically.
 * Renders nothing when there are no offers.
 */
export default function OffersStrip({ offers, accent, onPickCode }) {
  if (!Array.isArray(offers) || offers.length === 0) return null;

  const tap = async (o) => {
    if (o.application === "code" && o.code) {
      try {
        await navigator.clipboard?.writeText(o.code);
      } catch {
        /* copying is a bonus; applying is what matters */
      }
      onPickCode(o.code);
      toast.success(`${o.code} will be applied at checkout`, { id: "offer-code" });
    } else {
      toast(`${o.title || "This offer"} is applied automatically when your cart qualifies`, { id: "offer-auto" });
    }
  };

  return (
    <div className="flex gap-2 px-4 py-2.5 overflow-x-auto bg-white border-b border-gray-100" style={{ scrollbarWidth: "none" }}>
      {offers.map((o) => (
        <button
          key={o.id}
          onClick={() => tap(o)}
          className="shrink-0 max-w-[85vw] rounded-xl border border-dashed px-3 py-2 text-left active:scale-[0.98] transition"
          style={{ borderColor: accent, background: withAlpha(accent, "0d", "#f9fafb") }}
        >
          <span className="block text-xs font-semibold text-gray-900 truncate">🏷️ {o.label || o.title}</span>
          {o.application === "code" && o.code ? (
            <span className="block text-[11px] mt-0.5" style={{ color: accent }}>
              Tap to use <span className="font-mono font-bold">{o.code}</span>
            </span>
          ) : (
            <span className="block text-[11px] text-gray-500 mt-0.5">Auto-applied at checkout</span>
          )}
        </button>
      ))}
    </div>
  );
}
