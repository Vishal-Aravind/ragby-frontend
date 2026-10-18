"use client";

import { ShoppingCart } from "lucide-react";
import { QtyStepper } from "./MenuItemCard";
import { formatMoney } from "../_lib/shopApi";

/** Step 1: cart lines with − / + and the local item total (display only). */
export default function StepCart({ items, currency, accent, canOrder, onAdd, onRemove, onBrowse }) {
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="text-center py-16 px-6 space-y-3">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
          <ShoppingCart size={24} className="text-gray-400" />
        </div>
        <p className="font-semibold text-gray-900">Your cart is empty</p>
        <p className="text-sm text-gray-500">Add a few items from the menu to get started.</p>
        <button onClick={onBrowse} className="text-sm font-semibold" style={{ color: accent }}>
          Browse the menu
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3">
            {item.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0 bg-gray-100" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{item.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatMoney(currency, item.price)} each</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <QtyStepper
                qty={item.quantity}
                accent={accent}
                disabled={!canOrder}
                onAdd={() => onAdd(item)}
                onRemove={() => onRemove(item)}
                name={item.name}
                size="sm"
              />
              <span className="text-sm font-bold text-gray-900">{formatMoney(currency, item.price * item.quantity)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-3 flex justify-between text-sm">
        <span className="font-medium text-gray-700">Item total</span>
        <span className="font-bold text-gray-900">{formatMoney(currency, total)}</span>
      </div>
      <p className="text-xs text-gray-500 px-1">Taxes, delivery and offers are worked out in the Summary step.</p>
      <button onClick={onBrowse} className="text-sm font-semibold px-1" style={{ color: accent }}>
        + Add more items
      </button>
    </div>
  );
}
