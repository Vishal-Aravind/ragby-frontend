"use client";

import { Check, FileText } from "lucide-react";
import { formatMoney, invoiceHref } from "../_lib/shopApi";

export function paymentLine(method, fulfilment) {
  if (method === "online") return "Paid online";
  if (method === "none") return "Nothing to pay";
  return fulfilment === "delivery" ? "Pay on delivery" : "Pay at pickup";
}

/** Success screen for an order placed straight from the page (offline / free). */
export default function OrderPlaced({ projectId, result, currency, accent, onMyOrders, onBackToMenu }) {
  const total = result?.totals?.total;
  const saved = Number(result?.totals?.discount_amount) || 0;
  const sent = result?.whatsapp === "text" || result?.whatsapp === "template";
  const fulfilment = result?.fulfilment;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "#f8faf8" }}>
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg" style={{ background: accent }}>
          <Check size={36} color="white" strokeWidth={3} />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-gray-900">Order placed</h2>
          {result?.short_id && <p className="text-sm font-mono text-gray-500">#{result.short_id}</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2 text-left">
          {total != null && (
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-600">Total</span>
              <span className="text-xl font-bold text-gray-900">{formatMoney(currency, total)}</span>
            </div>
          )}
          {saved > 0 && <p className="text-xs font-semibold text-green-700 text-right">You saved {formatMoney(currency, saved)}</p>}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Payment</span>
            <span className="font-semibold text-gray-900">{paymentLine(result?.payment_method, fulfilment)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{fulfilment === "delivery" ? "Delivery from" : "Pickup at"}</span>
            <span className="font-semibold text-gray-900 text-right">{result?.branch_name || ""}</span>
          </div>
        </div>
        {result?.notice === "best_offer_applied" && (
          <p className="text-xs text-blue-700">We applied the best available offer for you.</p>
        )}
        <p className="text-sm text-gray-600">
          {sent ? "We've sent the details to your WhatsApp." : "Keep your order ID handy — the store will contact you if anything changes."}
        </p>
        <div className="space-y-2">
          {result?.invoice_number && projectId && (
            <a
              href={invoiceHref(projectId, result.order_id, result.receipt)}
              className="w-full py-3 rounded-xl border-2 bg-white font-semibold flex items-center justify-center gap-2"
              style={{ borderColor: accent, color: accent }}
            >
              <FileText size={16} /> View invoice
            </a>
          )}
          <button onClick={onMyOrders} className="w-full py-3.5 rounded-xl text-white font-semibold" style={{ background: accent }}>
            My Orders
          </button>
          <button onClick={onBackToMenu} className="w-full py-3 rounded-xl border border-gray-200 bg-white font-semibold text-gray-800">
            Back to menu
          </button>
        </div>
      </div>
    </div>
  );
}
