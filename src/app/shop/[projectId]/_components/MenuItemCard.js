"use client";

import { Plus, Minus } from "lucide-react";

/** One menu row. `disabled` = branch closed/paused: "+" greys out and taps explain why. */
export default function MenuItemCard({ product, qty, accent, currency, disabled, onAdd, onRemove, onBlocked }) {
  const add = () => (disabled ? onBlocked() : onAdd(product));
  return (
    <div
      className="bg-white rounded-xl p-3 flex gap-3 shadow-sm border"
      style={{ borderColor: qty > 0 ? accent : "#f3f4f6", borderWidth: qty > 0 ? 1.5 : 1 }}
    >
      {product.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image_url} alt={product.name} loading="lazy"
          className="w-20 h-20 object-cover rounded-lg shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1">
          <div className="w-4 h-4 border-2 rounded shrink-0 mt-0.5 flex items-center justify-center"
            style={{ borderColor: accent }}>
            <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
          </div>
          <p className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</p>
        </div>
        {product.description && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{product.description}</p>
        )}
        <p className="font-bold text-sm mt-1" style={{ color: accent }}>{currency}{product.price}</p>
      </div>
      <div className="shrink-0 flex items-end">
        {qty === 0 ? (
          <button
            onClick={add}
            aria-disabled={disabled || undefined}
            aria-label={`Add ${product.name}`}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold shadow-sm"
            style={{ background: disabled ? "#d1d5db" : accent }}
          >
            <Plus size={18} />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => onRemove(product)} aria-label={`Remove one ${product.name}`}
              className="w-8 h-8 rounded-lg border-2 flex items-center justify-center font-bold"
              style={{ borderColor: accent, color: accent }}>
              <Minus size={14} />
            </button>
            <span className="font-bold text-sm w-4 text-center" style={{ color: accent }}>{qty}</span>
            <button onClick={add} aria-disabled={disabled || undefined} aria-label={`Add one more ${product.name}`}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ background: disabled ? "#d1d5db" : accent }}>
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
