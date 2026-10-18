"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock, AlertTriangle, RotateCw } from "lucide-react";
import { getOrderStatus, formatMoney } from "../_lib/shopApi";

const POLL_MS = 3000;
const POLL_FOR_MS = 60000;

/**
 * Landing screen after Razorpay sends the customer back
 * (`?paid=<order_id>&r=<receipt>`). Razorpay's own razorpay_* params are
 * ignored: only the server's order status (fed by the webhook) counts.
 */
export default function PaymentReturn({ projectId, orderId, receipt, token, currency, accent, onPaid, onMyOrders, onBackToMenu }) {
  const [phase, setPhase] = useState("checking"); // checking | paid | underpaid | waiting | cancelled | missing
  const [order, setOrder] = useState(null);
  const [round, setRound] = useState(0);
  const paidOnce = useRef(false);
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const auth = receipt ? { receipt } : token ? { customer_token: token } : null;
  const authKey = JSON.stringify(auth);

  const check = useCallback(async () => {
    const a = JSON.parse(authKey);
    if (!a) return { done: true, phase: "missing" };
    const r = await getOrderStatus(projectId, orderId, a);
    if (r.status === 404) return { done: true, phase: "missing" };
    if (!r.ok || !r.data) return { done: false };
    const o = r.data;
    setOrder(o);
    const ps = o.payment_status;
    if (ps === "paid" && o.status === "cancelled") return { done: true, phase: "cancelled_paid" };
    if (ps === "paid" || ps === "not_required") return { done: true, phase: "paid" };
    if (ps === "underpaid") return { done: true, phase: "underpaid" };
    if (o.status === "cancelled") return { done: true, phase: "cancelled" };
    return { done: false };
  }, [projectId, orderId, authKey]);

  useEffect(() => {
    let alive = true;
    let timer = null;
    const started = Date.now();
    setPhase("checking");
    const tick = async () => {
      const res = await check();
      if (!alive) return;
      if (res.done) {
        setPhase(res.phase);
        if (res.phase === "paid" && !paidOnce.current) {
          paidOnce.current = true;
          onPaidRef.current?.();
        }
        return;
      }
      if (Date.now() - started >= POLL_FOR_MS) {
        setPhase("waiting");
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [check, round]);

  const total = order?.total;
  const shortId = order?.short_id;
  const money = (n) => formatMoney(currency, n);

  const icon = (bg, child) => (
    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg" style={{ background: bg }}>
      {child}
    </div>
  );

  let body;
  if (phase === "checking") {
    body = (
      <>
        <div className="w-14 h-14 rounded-full animate-spin mx-auto" style={{ border: "4px solid #e5e7eb", borderTopColor: accent }} />
        <h2 className="text-xl font-bold text-gray-900">Confirming your payment…</h2>
        <p className="text-sm text-gray-500">This usually takes a few seconds. Please don&apos;t close this page.</p>
      </>
    );
  } else if (phase === "paid") {
    body = (
      <>
        {icon(accent, <Check size={36} color="white" strokeWidth={3} />)}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-gray-900">Payment successful</h2>
          <p className="text-sm text-gray-600">
            {shortId ? <span className="font-mono">#{shortId}</span> : null}
            {shortId && total != null ? " · " : ""}
            {total != null ? <span className="font-semibold">{money(total)}</span> : null}
          </p>
        </div>
        <p className="text-sm text-gray-600">Your order is confirmed — a confirmation has been sent to your WhatsApp.</p>
      </>
    );
  } else if (phase === "underpaid") {
    body = (
      <>
        {icon("#f59e0b", <AlertTriangle size={34} color="white" />)}
        <h2 className="text-xl font-bold text-gray-900">Payment amount didn&apos;t match</h2>
        <p className="text-sm text-gray-600">The store will contact you about order {shortId ? <span className="font-mono">#{shortId}</span> : "this order"}.</p>
      </>
    );
  } else if (phase === "cancelled_paid") {
    body = (
      <>
        {icon("#f59e0b", <AlertTriangle size={34} color="white" />)}
        <h2 className="text-xl font-bold text-gray-900">We received your payment</h2>
        <p className="text-sm text-gray-600">
          Order {shortId ? <span className="font-mono">#{shortId}</span> : ""} was cancelled before the payment arrived. The store will contact you about a refund.
        </p>
      </>
    );
  } else if (phase === "cancelled") {
    body = (
      <>
        {icon("#9ca3af", <AlertTriangle size={34} color="white" />)}
        <h2 className="text-xl font-bold text-gray-900">This order was cancelled</h2>
        <p className="text-sm text-gray-600">No payment was taken. You can place a new order from the menu.</p>
      </>
    );
  } else if (phase === "missing") {
    body = (
      <>
        {icon("#9ca3af", <AlertTriangle size={34} color="white" />)}
        <h2 className="text-xl font-bold text-gray-900">We couldn&apos;t find this order</h2>
        <p className="text-sm text-gray-600">If you paid, you&apos;ll get a confirmation on WhatsApp shortly.</p>
      </>
    );
  } else {
    body = (
      <>
        {icon("#3b82f6", <Clock size={34} color="white" />)}
        <h2 className="text-xl font-bold text-gray-900">We&apos;re confirming your payment</h2>
        <p className="text-sm text-gray-600">You&apos;ll get a WhatsApp message shortly{shortId ? <> for order <span className="font-mono">#{shortId}</span></> : ""}.</p>
        <button
          onClick={() => setRound((n) => n + 1)}
          className="w-full py-3 rounded-xl border-2 font-semibold flex items-center justify-center gap-2 bg-white"
          style={{ borderColor: accent, color: accent }}
        >
          <RotateCw size={16} /> Check again
        </button>
        {typeof order?.pay_url === "string" && order.pay_url.startsWith("https://") && (
          <a href={order.pay_url} className="block text-sm font-semibold underline" style={{ color: accent }}>
            Haven&apos;t paid yet? Pay now
          </a>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "#f8faf8" }}>
      <div className="w-full max-w-sm text-center space-y-5">
        {body}
        {phase !== "checking" && (
          <div className="space-y-2 pt-2">
            <button onClick={onMyOrders} className="w-full py-3.5 rounded-xl text-white font-semibold" style={{ background: accent }}>
              My Orders
            </button>
            <button onClick={onBackToMenu} className="w-full py-3 rounded-xl border border-gray-200 bg-white font-semibold text-gray-800">
              Back to menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
