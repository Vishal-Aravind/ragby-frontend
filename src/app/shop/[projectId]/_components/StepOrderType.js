"use client";

import { Check } from "lucide-react";
import { formatMoney } from "../_lib/shopApi";

/** Step 2: two big cards. A card that is off at this branch is greyed with the reason. */
export default function StepOrderType({ branch, fulfilment, accent, currency, freeDeliveryOffer, onPick }) {
  const pickupOn = !!branch?.pickup_enabled;
  const deliveryOn = !!branch?.delivery_available;
  const prep = branch?.prep_minutes ? `ready in ~${branch.prep_minutes} min` : "ready when you arrive";
  const freeAbove = Number(branch?.free_delivery_above) > 0 ? `Free delivery above ${formatMoney(currency, branch.free_delivery_above)}` : null;

  const cards = [
    {
      key: "pickup",
      emoji: "🏃",
      title: "Pickup",
      sub: `From ${branch?.name || "the store"} · ${prep}`,
      on: pickupOn,
      reason: `Pickup isn't available at ${branch?.name || "this branch"}`,
    },
    {
      key: "delivery",
      emoji: "🛵",
      title: "Delivery",
      sub: "Delivered to your door",
      extra: branch?.delivers_here === false ? "This branch may not deliver to your area" : freeAbove,
      on: deliveryOn,
      reason: "Delivery isn't available at this branch",
      tag: freeDeliveryOffer ? "Free delivery offer" : null,
    },
  ];

  return (
    <div className="px-4 py-5 space-y-3">
      <h2 className="text-base font-bold text-gray-900 px-1">How would you like your order?</h2>
      {cards.map((c) => {
        const selected = fulfilment === c.key && c.on;
        return (
          <button
            key={c.key}
            type="button"
            disabled={!c.on}
            onClick={() => onPick(c.key)}
            className="w-full text-left bg-white rounded-2xl border-2 p-4 flex items-center gap-4 transition active:scale-[0.99] disabled:active:scale-100"
            style={{
              borderColor: selected ? accent : "#e5e7eb",
              opacity: c.on ? 1 : 0.55,
              background: c.on ? "white" : "#f9fafb",
            }}
          >
            <span className="text-4xl leading-none" aria-hidden="true" style={{ filter: c.on ? "none" : "grayscale(1)" }}>
              {c.emoji}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-900 text-lg">{c.title}</span>
                {c.on && c.tag && (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold bg-green-100 text-green-800">{c.tag}</span>
                )}
              </span>
              <span className="block text-sm text-gray-600 mt-0.5">{c.on ? c.sub : c.reason}</span>
              {c.on && c.extra && <span className="block text-xs text-gray-500 mt-0.5">{c.extra}</span>}
            </span>
            {selected && (
              <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: accent }}>
                <Check size={14} color="white" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
