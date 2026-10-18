"use client";

import { Plus, Minus } from "lucide-react";
import { formatMoney } from "../_lib/shopApi";

/** Quantity control shared by the menu card and the cart step: "Add" → "− 1 +". */
export function QtyStepper({ qty, accent, disabled, onAdd, onRemove, name, size = "md" }) {
  const h = size === "sm" ? "h-8" : "h-9";
  if (qty === 0) {
    return (
      <button
        onClick={onAdd}
        aria-disabled={disabled || undefined}
        aria-label={`Add ${name}`}
        className={`${h} min-w-[84px] px-4 rounded-lg border bg-white font-bold text-sm uppercase shadow-sm active:scale-95 transition`}
        style={{ borderColor: disabled ? "#e5e7eb" : accent, color: disabled ? "#9ca3af" : accent }}
      >
        Add
      </button>
    );
  }
  return (
    <div
      className={`${h} min-w-[84px] rounded-lg flex items-center justify-between text-white font-bold shadow-sm overflow-hidden`}
      style={{ background: disabled ? "#9ca3af" : accent }}
    >
      <button onClick={onRemove} aria-label={`Remove one ${name}`} className="h-full px-2.5 flex items-center active:bg-black/10">
        <Minus size={14} strokeWidth={3} />
      </button>
      <span className="text-sm tabular-nums" aria-live="polite">{qty}</span>
      <button
        onClick={onAdd}
        aria-disabled={disabled || undefined}
        aria-label={`Add one more ${name}`}
        className="h-full px-2.5 flex items-center active:bg-black/10"
      >
        <Plus size={14} strokeWidth={3} />
      </button>
    </div>
  );
}

/** One menu row. `disabled` = branch closed/paused: adding greys out and taps explain why. */
export default function MenuItemCard({ product, qty, accent, currency, disabled, onAdd, onRemove, onBlocked }) {
  const add = () => (disabled ? onBlocked() : onAdd(product));
  const hasImage = !!product.image_url;
  return (
    <div className="bg-white rounded-2xl p-3 flex gap-3 border border-gray-100 shadow-sm">
      <div className="flex-1 min-w-0 py-0.5">
        <p className="font-semibold text-gray-900 text-[15px] leading-snug">{product.name}</p>
        <p className="font-bold text-sm mt-1 text-gray-900">{formatMoney(currency, product.price)}</p>
        {product.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
        )}
        {!hasImage && (
          <div className="mt-2.5">
            <QtyStepper qty={qty} accent={accent} disabled={disabled} onAdd={add} onRemove={() => onRemove(product)} name={product.name} />
          </div>
        )}
      </div>
      {hasImage && (
        <div className="relative shrink-0 w-28 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="w-28 h-24 object-cover rounded-xl bg-gray-100"
          />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
            <QtyStepper qty={qty} accent={accent} disabled={disabled} onAdd={add} onRemove={() => onRemove(product)} name={product.name} />
          </div>
        </div>
      )}
    </div>
  );
}
