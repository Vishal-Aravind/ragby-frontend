"use client";

import { useState } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import CouponBox from "./CouponBox";
import { formatMoney, formatKm } from "../_lib/shopApi";

const SOLD_OUT_OPTIONS = [
  { key: "remove_item", label: "Remove it from my order" },
  { key: "call_me", label: "Call me" },
  { key: "merchant_choice", label: "Use the store's recommendation" },
];

function Skeleton({ w = "w-14" }) {
  return <span className={`inline-block h-3.5 ${w} rounded bg-gray-200 animate-pulse align-middle`} />;
}

function Card({ title, action, onAction, accent, children }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
        {action && (
          <button onClick={onAction} className="text-sm font-semibold shrink-0" style={{ color: accent }}>
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Line shown for one quote error (shared with the Details step). */
export function quoteErrorText(e, status) {
  switch (e.code) {
    case "out_of_area":
      return "This branch doesn't deliver to your location. Try Pickup or another branch.";
    case "location_required":
      return e.message && /branch/i.test(e.message) ? e.message : "Set your delivery location on the map.";
    case "branch_closed":
    case "branch_paused":
      return status?.label || e.message || "This branch isn't taking orders right now.";
    case "item_unavailable":
    case "item_not_on_menu":
      return "Some items are no longer available.";
    default:
      return e.message || "This order can't be placed right now.";
  }
}

/**
 * Step 4. Every amount here is the server quote's; nothing is added up
 * locally. The primary button lives in the CheckoutFlow footer.
 */
export default function StepSummary({
  items, branch, fulfilment, form, quote, quoteState, quoteErr, status, currency, accent,
  couponBusy, couponMessage, couponDisabledText, onApplyCoupon, onRemoveCoupon,
  soldOut, setSoldOut, note, setNote, onRetryQuote, onGo, onKeepOnly,
}) {
  const [showAll, setShowAll] = useState(false);
  const money = (n) => formatMoney(currency, n);
  const isDelivery = fulfilment === "delivery";
  const ready = quoteState === "ready" && !!quote;

  // Server item lines once quoted (prices the customer pays), cart lines until then.
  const lines = ready && Array.isArray(quote.items) && quote.items.length
    ? quote.items.map((i) => ({ id: i.product_id, name: i.name, quantity: i.quantity, total: i.line_total }))
    : items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, total: null }));
  const visible = showAll ? lines : lines.slice(0, 2);

  const errors = ready ? quote.errors || [] : [];
  const errorLines = [];
  for (const e of errors) {
    const text = quoteErrorText(e, status);
    if (!errorLines.some((l) => l.text === text)) errorLines.push({ code: e.code, text });
  }
  const hasItemProblem = errors.some((e) => e.code === "item_unavailable" || e.code === "item_not_on_menu");

  const fee = ready ? Number(quote.delivery_fee) || 0 : 0;
  const deliveryDiscount = ready ? Number(quote.delivery_discount) || 0 : 0;
  const itemsDiscount = ready ? Number(quote.items_discount) || 0 : 0;
  const discountTotal = ready ? Number(quote.discount_amount) || 0 : 0;
  const discountLabel = quote?.offer ? (quote.offer.code || quote.offer.title || "Offer") : "Offer";

  const a = form.address || {};
  const addressText = [a.line1, a.line2, a.city].map((x) => (x || "").trim()).filter(Boolean).join(", ");

  return (
    <div className="px-4 py-4 space-y-3">
      {errorLines.length > 0 && (
        <div className="space-y-2">
          {errorLines.map((l) => (
            <div key={l.text} className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700 space-y-1.5" role="alert">
              <p>{l.text}</p>
              {(l.code === "item_unavailable" || l.code === "item_not_on_menu") && hasItemProblem && (
                <button
                  onClick={() => onKeepOnly(new Set((quote.items || []).map((i) => i.product_id)))}
                  className="text-xs font-semibold underline"
                >
                  Remove unavailable items
                </button>
              )}
              {(l.code === "out_of_area" || l.code === "location_required") && (
                <button onClick={() => onGo(3)} className="text-xs font-semibold underline">Change address</button>
              )}
            </div>
          ))}
        </div>
      )}

      <Card title={`Items (${items.reduce((s, i) => s + i.quantity, 0)})`} action="Edit" onAction={() => onGo(1)} accent={accent}>
        <ul className="space-y-1">
          {visible.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 text-sm">
              <span className="text-gray-700 min-w-0 truncate">{l.name} <span className="text-gray-400">×{l.quantity}</span></span>
              {l.total != null && <span className="text-gray-900 shrink-0">{money(l.total)}</span>}
            </li>
          ))}
        </ul>
        {lines.length > 2 && (
          <button onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold mt-1.5" style={{ color: accent }}>
            {showAll ? "Show less" : `Show all ${lines.length} items`}
          </button>
        )}
      </Card>

      <Card title="Order type" action="Change" onAction={() => onGo(2)} accent={accent}>
        <p className="text-sm text-gray-700">{isDelivery ? "🛵 Delivery" : "🏃 Pickup"}</p>
      </Card>

      <Card title={isDelivery ? "Deliver to" : "Pickup at"} action="Change" onAction={() => onGo(3)} accent={accent}>
        {isDelivery ? (
          <div className="text-sm text-gray-700 space-y-0.5">
            <p className="font-semibold text-gray-900">{form.name}</p>
            <p>{addressText}{a.pincode ? ` — ${a.pincode}` : ""}</p>
            {ready && quote.delivery_distance_km != null && (
              <p className="text-xs text-gray-500">{formatKm(quote.delivery_distance_km)} from {branch?.name}</p>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-700 space-y-0.5">
            <p className="font-semibold text-gray-900">{branch?.name}</p>
            {branch?.address && <p>{branch.address}</p>}
            <p className="text-xs text-gray-500">Name: {form.name}</p>
          </div>
        )}
      </Card>

      <CouponBox
        quote={ready ? quote : null}
        currency={currency}
        accent={accent}
        busy={couponBusy || quoteState === "loading"}
        disabledText={couponDisabledText}
        message={couponMessage}
        onApply={onApplyCoupon}
        onRemove={onRemoveCoupon}
      />

      <section className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="font-bold text-gray-900 text-sm mb-2">Price details</h3>
        {quoteState === "error" ? (
          <div className="flex items-center justify-between gap-2 text-sm text-gray-700">
            <span className="flex items-center gap-1.5"><AlertCircle size={14} className="text-red-500 shrink-0" />{quoteErr || "Couldn't calculate the total"}</span>
            <button onClick={onRetryQuote} className="flex items-center gap-1 font-semibold shrink-0" style={{ color: accent }}>
              <RotateCw size={13} />Retry
            </button>
          </div>
        ) : (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Item total</span>{ready ? <span>{money(quote.subtotal)}</span> : <Skeleton />}
            </div>
            {ready && itemsDiscount > 0 && (
              <div className="flex justify-between text-green-700 font-medium">
                <span className="min-w-0 truncate">Discount ({discountLabel})</span><span className="shrink-0">−{money(itemsDiscount)}</span>
              </div>
            )}
            {(!ready || Number(quote.gst_percent) > 0) && (
              <div className="flex justify-between text-gray-600">
                <span>GST{ready ? ` (${quote.gst_percent}%)` : ""}</span>{ready ? <span>{money(quote.gst_amount)}</span> : <Skeleton />}
              </div>
            )}
            {isDelivery && (
              <div className="flex justify-between text-gray-600">
                <span>Delivery fee</span>
                {!ready ? <Skeleton /> : !quote.delivery?.available ? <span>—</span> : deliveryDiscount > 0 && fee > 0 ? (
                  <span><s className="text-gray-400 mr-1">{money(fee)}</s><span className="font-semibold text-green-700">FREE</span></span>
                ) : fee === 0 ? (
                  <span className="font-semibold text-green-700">FREE</span>
                ) : (
                  <span>{money(fee)}</span>
                )}
              </div>
            )}
            {ready && isDelivery && quote.delivery?.available && deliveryDiscount === 0 && Number(quote.amount_to_free_delivery) > 0 && (
              <p className="text-xs text-green-700">Add {money(quote.amount_to_free_delivery)} more for free delivery</p>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base pt-2 mt-1 border-t border-gray-100">
              <span>To pay</span>{ready ? <span>{money(quote.total)}</span> : <Skeleton w="w-20" />}
            </div>
            {ready && discountTotal > 0 && (
              <div className="mt-2 rounded-lg bg-green-50 text-green-800 text-sm font-semibold text-center py-2">
                🎉 You save {money(discountTotal)} on this order
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="font-bold text-gray-900 text-sm mb-2">If an item is sold out</h3>
        <div className="space-y-1" role="radiogroup" aria-label="If an item is sold out">
          {SOLD_OUT_OPTIONS.map((o) => (
            <label key={o.key} className="flex items-center gap-3 py-1.5 cursor-pointer">
              <input
                type="radio"
                name="sold_out"
                value={o.key}
                checked={soldOut === o.key}
                onChange={() => setSoldOut(o.key)}
                className="w-4 h-4"
                style={{ accentColor: accent }}
              />
              <span className="text-sm text-gray-800">{o.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-4">
        <label className="block">
          <span className="font-bold text-gray-900 text-sm">Instructions <span className="text-gray-400 font-normal">(optional)</span></span>
          <textarea
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value.replace(/[\r\n]+/g, " "))}
            placeholder="Cooking or packing notes, e.g. less spicy"
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base outline-none focus:border-gray-400 resize-none"
          />
          <span className="block text-right text-[11px] text-gray-400">{note.length}/300</span>
        </label>
      </section>
    </div>
  );
}
