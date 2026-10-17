"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, ExternalLink, Store } from "lucide-react";

// Order statuses (shared contract). Old rows may still say "delivered";
// the backend stores that as "completed".
export const ORDER_STATUSES = [
  ["pending", "Pending"],
  ["confirmed", "Confirmed"],
  ["preparing", "Preparing"],
  ["ready", "Ready"],
  ["out_for_delivery", "Out for delivery"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];
const STATUS_LABEL = Object.fromEntries(ORDER_STATUSES);
export const FINAL_STATUSES = ["completed", "cancelled"];

export function normalizeStatus(s) {
  return s === "delivered" ? "completed" : s || "pending";
}

const STATUS_COLORS = {
  pending:          "bg-yellow-100 text-yellow-700 border-yellow-200",
  confirmed:        "bg-blue-100 text-blue-700 border-blue-200",
  preparing:        "bg-indigo-100 text-indigo-700 border-indigo-200",
  ready:            "bg-purple-100 text-purple-700 border-purple-200",
  out_for_delivery: "bg-orange-100 text-orange-700 border-orange-200",
  completed:        "bg-green-100 text-green-700 border-green-200",
  cancelled:        "bg-red-100 text-red-700 border-red-200",
};

const PAYMENT_STATUS_COLORS = {
  unpaid:    "bg-gray-100 text-gray-600 border-gray-200",
  link_sent: "bg-orange-100 text-orange-700 border-orange-200",
  paid:      "bg-green-100 text-green-700 border-green-200",
};

export function isDelivery(order) {
  if (order.fulfilment) return order.fulfilment === "delivery";
  return /deliver/i.test(order.delivery_type || "");
}

// Next-step buttons, per the status table in the spec. Cancel is separate.
function nextActions(status, delivery) {
  switch (status) {
    case "pending":   return [["confirmed", "Confirm"]];
    case "confirmed": return [["preparing", "Start preparing"], ["ready", "Mark ready"]];
    case "preparing": return delivery ? [["ready", "Mark ready"], ["out_for_delivery", "Out for delivery"]] : [["ready", "Mark ready"]];
    case "ready":     return delivery ? [["out_for_delivery", "Out for delivery"]] : [["completed", "Picked up"]];
    case "out_for_delivery": return delivery ? [["completed", "Delivered"]] : [];
    default: return [];
  }
}

const money = (currency, v) => `${currency}${Number(v || 0).toFixed(2)}`;

export default function OrderCard({ order, currency = "₹", branchName, busy, onAction }) {
  const status = normalizeStatus(order.status);
  const delivery = isDelivery(order);
  const actions = nextActions(status, delivery);
  const canCancel = !FINAL_STATUSES.includes(status);
  const distance = order.delivery_distance_km != null ? Number(order.delivery_distance_km) : null;
  const hasCoords = order.customer_lat != null && order.customer_lng != null;
  const deliveryFee = Number(order.delivery_fee || 0);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-gray-600">
                #{String(order.id).slice(0, 8).toUpperCase()}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {STATUS_LABEL[status] || status}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PAYMENT_STATUS_COLORS[order.payment_status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {order.payment_status === "paid" ? "✓ Paid" : order.payment_status === "link_sent" ? "Link Sent" : "Unpaid"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${delivery ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                {delivery ? `🛵 Delivery${distance != null ? ` · ${distance} km` : ""}` : "🏃 Pickup"}
              </span>
              {branchName && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white text-gray-600 border border-gray-200">
                  <Store size={10} /> {branchName}
                </span>
              )}
              <span className="text-xs text-gray-400">
                {new Date(order.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {/* Customer */}
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              {order.customer_name && <span className="font-medium text-gray-800 text-sm">{order.customer_name}</span>}
              {order.phone_number && <span>📞 +{order.phone_number}</span>}
            </div>

            {/* Items */}
            <div className="text-sm text-gray-700">
              {(order.items || []).map((item, i) => (
                <span key={i}>
                  {item.name} x{item.quantity}
                  {i < order.items.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>

            {/* Delivery address */}
            {delivery && (order.delivery_address || order.customer_pincode) && (
              <div className="flex items-start gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">
                <MapPin size={12} className="mt-0.5 shrink-0 text-gray-400" />
                <span className="flex-1 min-w-0">
                  {[order.delivery_address, order.customer_pincode].filter(Boolean).join(", ")}
                  {hasCoords && (
                    <a href={`https://maps.google.com/?q=${Number(order.customer_lat)},${Number(order.customer_lng)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-0.5 text-indigo-600 hover:underline whitespace-nowrap">
                      Open in Maps <ExternalLink size={10} />
                    </a>
                  )}
                </span>
              </div>
            )}

            {/* Totals */}
            <div className="flex items-center gap-x-3 gap-y-1 text-xs text-gray-400 flex-wrap">
              {order.subtotal != null && <span>Subtotal {money(currency, order.subtotal)}</span>}
              {Number(order.gst_amount) > 0 && <span>GST {money(currency, order.gst_amount)}</span>}
              {delivery && <span>Delivery {deliveryFee > 0 ? money(currency, deliveryFee) : "FREE"}</span>}
              <span className="font-semibold text-gray-800 text-sm">Total {money(currency, order.total)}</span>
            </div>

            {order.special_request && (
              <p className="text-xs text-orange-600">📝 {order.special_request}</p>
            )}
          </div>

          {/* Actions */}
          {(actions.length > 0 || canCancel) && (
            <div className="flex sm:flex-col flex-wrap gap-1.5 shrink-0">
              {actions.map(([next, label], i) => (
                <Button key={next} size="sm" variant={i === 0 ? "default" : "outline"} disabled={busy}
                  onClick={() => onAction(order, next)}>
                  {busy && i === 0 ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                  {label}
                </Button>
              ))}
              {canCancel && (
                <Button size="sm" variant="ghost" disabled={busy}
                  onClick={() => onAction(order, "cancelled")}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs">
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
