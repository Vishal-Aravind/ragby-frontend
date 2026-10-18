"use client";

import { useEffect, useState } from "react";
import { Tag, CheckCircle2 } from "lucide-react";
import { formatMoney, offerReasonText } from "../_lib/shopApi";

/**
 * Offers block of the Summary step. Everything it shows (applied offer,
 * saving, eligibility, reasons) comes from the server quote; the box only
 * decides which code to send next.
 *
 * message: {tone: "error" | "info", text} | null — rejection / not_better /
 *          place-order offer errors, owned by the parent.
 */
export default function CouponBox({ quote, currency, accent, busy, disabledText, message, onApply, onRemove }) {
  const [input, setInput] = useState("");
  const money = (n) => formatMoney(currency, n);

  const offer = quote?.offer || null;
  const coupon = quote?.coupon || null;
  const appliedByCode = offer && coupon && coupon.status === "applied";
  const saving = Number(quote?.discount_amount) || Number(offer?.saving) || 0;
  const list = Array.isArray(quote?.available_offers) ? quote.available_offers : [];

  // A successfully applied code clears the input.
  useEffect(() => {
    if (appliedByCode) setInput("");
  }, [appliedByCode]);

  if (disabledText) {
    return (
      <section className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5"><Tag size={15} /> Offers</h3>
        <p className="text-sm text-gray-500 mt-1.5">{disabledText}</p>
      </section>
    );
  }

  const submit = (e) => {
    e.preventDefault();
    const code = input.trim();
    if (code && !busy) onApply(code);
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5"><Tag size={15} /> Offers &amp; coupons</h3>

      {offer && saving > 0 && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 flex items-start gap-2">
          <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800">
              {appliedByCode ? <span className="font-mono">{offer.code || coupon.code}</span> : offer.title} applied — you save {money(saving)}
            </p>
            {!appliedByCode && <p className="text-xs text-green-700">Applied automatically</p>}
          </div>
          {appliedByCode && (
            <button onClick={onRemove} disabled={busy} className="text-sm font-semibold text-red-600 shrink-0 disabled:opacity-50">
              Remove
            </button>
          )}
        </div>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_ -]/g, "").slice(0, 24))}
          placeholder="Enter coupon code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Coupon code"
          className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-base font-mono uppercase outline-none focus:border-gray-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || busy}
          className="px-4 rounded-xl font-semibold text-sm text-white disabled:opacity-50"
          style={{ background: accent }}
        >
          {busy ? "…" : "Apply"}
        </button>
      </form>
      {message?.text && (
        <p className={`text-xs font-medium ${message.tone === "info" ? "text-blue-700" : "text-red-600"}`} role="status">
          {message.text}
        </p>
      )}

      {list.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Available offers</p>
          {list.map((o) => {
            const isApplied = offer && offer.id === o.id;
            const isCode = o.application === "code" && o.code;
            return (
              <div
                key={o.id}
                className="rounded-xl border px-3 py-2.5 flex items-start gap-3"
                style={{
                  borderColor: isApplied ? "#86efac" : "#e5e7eb",
                  background: o.eligible ? "white" : "#f9fafb",
                }}
              >
                <div className={`flex-1 min-w-0 ${o.eligible ? "" : "opacity-70"}`}>
                  <p className="text-sm font-semibold text-gray-900">{o.title}</p>
                  {o.label && <p className="text-xs text-gray-500 mt-0.5">{o.label}</p>}
                  {isCode && <p className="text-xs font-mono font-bold mt-1" style={{ color: accent }}>{o.code}</p>}
                  {!o.eligible && (
                    <p className="text-xs text-amber-700 mt-1">{o.message || offerReasonText(o.reason)}</p>
                  )}
                  {o.eligible && Number(o.saving) > 0 && !isApplied && (
                    <p className="text-xs text-green-700 mt-1">Saves {money(o.saving)}</p>
                  )}
                </div>
                {isApplied ? (
                  <span className="text-xs font-bold text-green-700 shrink-0 mt-0.5">Applied</span>
                ) : o.eligible && isCode ? (
                  <button
                    onClick={() => onApply(o.code)}
                    disabled={busy}
                    className="text-sm font-bold shrink-0 disabled:opacity-50"
                    style={{ color: accent }}
                  >
                    Apply
                  </button>
                ) : o.eligible ? (
                  <span className="text-[11px] text-gray-500 shrink-0 mt-0.5 text-right max-w-[90px]">Auto-applies when it&apos;s the best deal</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
