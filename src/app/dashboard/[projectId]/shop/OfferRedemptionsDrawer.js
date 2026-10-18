"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Loader2, ClipboardList } from "lucide-react";
import { fmtAmount } from "./OfferEditor";

const REDEMPTION_STATUS = {
  confirmed: ["Used", "bg-green-50 text-green-700 border-green-200"],
  held: ["Awaiting payment", "bg-orange-50 text-orange-700 border-orange-200"],
  released: ["Released", "bg-gray-50 text-gray-500 border-gray-200"],
};

const ORDER_STATUS_LABEL = {
  pending: "Pending", confirmed: "Confirmed", preparing: "Preparing", ready: "Ready",
  out_for_delivery: "Out for delivery", completed: "Completed", delivered: "Completed", cancelled: "Cancelled",
};

// Orders that used an offer (GET /shop/offers/{id}/redemptions).
export default function OfferRedemptionsDrawer({ offer, currency = "₹", onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const offerId = offer?.id;

  const load = async () => {
    if (!offerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/shop-offers/${offerId}/redemptions?limit=50`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) setRows(data);
      else setError(data?.error || "Couldn't load the orders for this offer.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [offerId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet open={!!offer} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 gap-0 overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle>Orders using {offer?.title || "this offer"}</SheetTitle>
          <SheetDescription>{offer?.label || ""}</SheetDescription>
        </SheetHeader>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 size={18} className="animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-8 border border-red-200 bg-red-50 rounded-xl text-sm">
              <p className="text-red-700 font-medium">{error}</p>
              <button onClick={load} className="mt-2 text-xs underline text-gray-500">Try again</button>
            </div>
          ) : rows.length === 0 ? (
            <div className="border-2 border-dashed rounded-xl p-10 text-center">
              <ClipboardList size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No orders have used this offer yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map(r => {
                const [label, cls] = REDEMPTION_STATUS[r.status] || [r.status, "bg-gray-50 text-gray-500 border-gray-200"];
                const shortId = r.short_id || String(r.order_id || "").slice(0, 8).toUpperCase();
                return (
                  <div key={r.order_id} className="border rounded-xl px-3 py-2.5 bg-white">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-gray-600">#{shortId}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
                      {r.order_status && (
                        <span className="text-[11px] text-gray-400">Order: {ORDER_STATUS_LABEL[r.order_status] || r.order_status}</span>
                      )}
                      <span className="text-[11px] text-gray-400 ml-auto">
                        {r.created_at ? new Date(r.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                      {r.customer_phone_masked && <span>📞 {r.customer_phone_masked}</span>}
                      <span className="text-green-700">−{currency}{fmtAmount(r.discount_amount)} off</span>
                      {r.order_total != null && <span className="font-medium text-gray-800">Total {currency}{fmtAmount(r.order_total)}</span>}
                    </div>
                  </div>
                );
              })}
              {rows.length >= 50 && <p className="text-xs text-gray-400 text-center pt-1">Showing the latest 50</p>}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
