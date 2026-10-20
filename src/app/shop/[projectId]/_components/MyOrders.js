"use client";

import { useCallback, useEffect, useState } from "react";
import { Receipt, RotateCw, ShoppingBag, Bike } from "lucide-react";
import { getMyOrders, formatMoney, formatDateTime, errorCode, openWhatsAppChat, invoiceHref } from "../_lib/shopApi";

function chipStyle(o) {
  const s = o.status;
  if (s === "cancelled") return { background: "#f3f4f6", color: "#6b7280" };
  if (s === "completed") return { background: "#dcfce7", color: "#166534" };
  if (s === "pending" && o.payment_status === "link_sent") return { background: "#fef3c7", color: "#92400e" };
  return { background: "#dbeafe", color: "#1e40af" };
}

/** This customer's orders (token-verified). Pay now / Reorder per card. */
export default function MyOrders({ projectId, token, verified, currency, accent, storePhone, onReorder }) {
  const [state, setState] = useState("loading"); // loading | ready | error | unverified
  const [orders, setOrders] = useState([]);
  const [nonce, setNonce] = useState(0);

  const load = useCallback(async () => {
    if (!verified || !token) {
      setState("unverified");
      return;
    }
    setState("loading");
    const r = await getMyOrders(projectId, token, 20);
    if (r.ok && r.data && Array.isArray(r.data.orders)) {
      setOrders(r.data.orders);
      setState("ready");
    } else if (r.status === 401 || errorCode(r.data) === "token_required") {
      setState("unverified");
    } else {
      setState("error");
    }
  }, [projectId, token, verified]);

  useEffect(() => {
    load();
  }, [load, nonce]);

  const money = (n) => formatMoney(currency, n);

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 pb-6 space-y-3">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Receipt size={20} /> My Orders</h1>

      {state === "unverified" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-3">
          <p className="text-sm text-gray-700">Open the menu from your WhatsApp chat to see your orders.</p>
          <button
            onClick={() => openWhatsAppChat(storePhone)}
            className="w-full py-3 rounded-xl text-white font-semibold"
            style={{ background: accent }}
          >
            💬 Open WhatsApp
          </button>
        </div>
      )}

      {state === "loading" &&
        [0, 1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-white border border-gray-100 animate-pulse" />)}

      {state === "error" && (
        <div className="text-center py-10 space-y-3">
          <p className="text-sm text-gray-500">Couldn&apos;t load your orders.</p>
          <button onClick={() => setNonce((n) => n + 1)} className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: accent }}>
            <RotateCw size={14} /> Try again
          </button>
        </div>
      )}

      {state === "ready" && orders.length === 0 && (
        <div className="text-center py-14 space-y-2">
          <p className="text-4xl">🧾</p>
          <p className="font-semibold text-gray-900">No orders yet</p>
          <p className="text-sm text-gray-500">Your orders from this store will show up here.</p>
        </div>
      )}

      {state === "ready" &&
        orders.map((o) => {
          const items = Array.isArray(o.items) ? o.items : [];
          const itemsText = items.map((i) => `${i.name} ×${i.quantity}`).join(", ");
          const saved = Number(o.discount_amount) || 0;
          const payUrl = typeof o.pay_url === "string" && o.pay_url.startsWith("https://") ? o.pay_url : null;
          return (
            <div key={o.order_id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    <span className="font-mono">#{o.short_id}</span>
                    <span className="text-gray-400 font-normal"> · {formatDateTime(o.placed_at || o.created_at)}</span>
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    {o.fulfilment === "delivery" ? <Bike size={12} /> : <ShoppingBag size={12} />}
                    {o.branch_name || ""} · {o.fulfilment === "delivery" ? "Delivery" : "Pickup"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={chipStyle(o)}>
                  {o.status_label || o.status}
                </span>
              </div>
              {itemsText && <p className="text-sm text-gray-700 line-clamp-2">{itemsText}</p>}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div>
                  <span className="font-bold text-gray-900">{money(o.total)}</span>
                  {saved > 0 && <span className="ml-2 text-xs font-semibold text-green-700">Saved {money(saved)}</span>}
                </div>
                <div className="flex gap-2">
                  {o.invoice_number && (
                    <a
                      href={invoiceHref(projectId, o.order_id)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-700"
                    >
                      Invoice
                    </a>
                  )}
                  {payUrl && (
                    <button
                      onClick={() => window.location.assign(payUrl)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
                      style={{ background: accent }}
                    >
                      Pay now
                    </button>
                  )}
                  {items.length > 0 && (
                    <button
                      onClick={() => onReorder(o)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold border bg-white"
                      style={{ borderColor: accent, color: accent }}
                    >
                      Reorder
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
