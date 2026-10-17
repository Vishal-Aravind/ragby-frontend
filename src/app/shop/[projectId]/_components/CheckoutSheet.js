"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, Navigation, Map as MapIcon, AlertCircle, RotateCw } from "lucide-react";
import MapModal from "./MapModal";
import {
  getQuote, submitCart, errorMessage, errorCode, getCurrentPosition, formatMoney, formatKm,
} from "../_lib/shopApi";

const NAME_MAX = 80;
const ADDR_MIN = 10;
const ADDR_MAX = 300;

function pincodeLooksValid(pc, india) {
  const v = (pc || "").trim();
  return india ? /^[1-9]\d{5}$/.test(v) : /^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/.test(v);
}

function Skeleton() {
  return <span className="inline-block h-3.5 w-14 rounded bg-gray-200 animate-pulse align-middle" />;
}

/**
 * Pickup / delivery choice, delivery details and the live server quote.
 * Every number in the totals block comes from POST /quote; nothing here
 * adds up money on its own.
 */
export default function CheckoutSheet({
  projectId, phone, branch, status, currency, accent, india,
  cartLines, catalogId, orderId, origin, locked, canChangeBranch,
  form, setForm,
  onClose, onBack, onChangeBranch, onKeepOnly, onSubmitted, onOrderNotEditable,
}) {
  const pickupOn = !!branch?.pickup_enabled;
  const deliveryOn = !!branch?.delivery_available;
  const fulfilment = form.fulfilment;
  const isDelivery = fulfilment === "delivery";

  const [quote, setQuote] = useState(null);
  const [quoteState, setQuoteState] = useState("loading"); // loading | ready | error
  const [quoteErr, setQuoteErr] = useState("");
  const [retry, setRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState("");

  // If the selected option is off at this branch, fall back to the other.
  useEffect(() => {
    if (fulfilment === "delivery" && !deliveryOn && pickupOn) setForm((f) => ({ ...f, fulfilment: "pickup" }));
    if (fulfilment === "pickup" && !pickupOn && deliveryOn) setForm((f) => ({ ...f, fulfilment: "delivery" }));
  }, [fulfilment, pickupOn, deliveryOn, setForm]);

  const pincodeOk = pincodeLooksValid(form.pincode, india);
  const quoteBody = useMemo(() => {
    const body = {
      branch_id: branch?.id,
      items: cartLines,
      fulfilment,
    };
    if (isDelivery) {
      if (form.coords) {
        body.customer_lat = form.coords.lat;
        body.customer_lng = form.coords.lng;
      }
      if (pincodeOk) body.customer_pincode = form.pincode.trim();
    }
    return body;
  }, [branch?.id, cartLines, fulfilment, isDelivery, form.coords, form.pincode, pincodeOk]);

  const quoteKey = JSON.stringify(quoteBody);
  const canOrderNow = status?.can_order;

  useEffect(() => {
    let cancelled = false;
    setQuoteState("loading");
    const t = setTimeout(async () => {
      const r = await getQuote(projectId, JSON.parse(quoteKey));
      if (cancelled) return;
      if (r.ok && r.data) {
        setQuote(r.data);
        setQuoteState("ready");
        setQuoteErr("");
      } else {
        setQuoteState("error");
        // 4xx carries a message written for the customer; a network
        // failure or 5xx gets the generic retry line.
        setQuoteErr(r.status >= 400 && r.status < 500 ? errorMessage(r.data) : "");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [projectId, quoteKey, retry, canOrderNow]);

  const nameT = (form.name || "").trim();
  const addrT = (form.address || "").trim();
  const fieldProblems = [];
  if (isDelivery) {
    if (!nameT) fieldProblems.push("Enter your name");
    if (addrT.length < ADDR_MIN) fieldProblems.push("Enter your full address (house / flat, street, landmark)");
    if (!pincodeOk) fieldProblems.push("Enter a valid pincode");
    if (!form.coords) fieldProblems.push("Set your delivery location on the map");
  }

  const ready = quoteState === "ready" && quote;
  const errors = ready ? quote.errors || [] : [];
  const hasItemProblem = errors.some((e) => e.code === "item_unavailable" || e.code === "item_not_on_menu");
  const canSubmit = ready && quote.ok && !!phone && !submitting && fieldProblems.length === 0;

  const errorText = (e) => {
    switch (e.code) {
      case "out_of_area":
        return "This branch doesn't deliver to your location. Try Pickup or another branch.";
      case "location_required":
        return e.message && /branch/i.test(e.message) ? e.message : "Set your delivery location on the map.";
      case "branch_closed":
      case "branch_paused":
        return status?.label || e.message;
      case "item_unavailable":
      case "item_not_on_menu":
        return "Some items are no longer available.";
      default:
        return e.message || "This order can't be placed right now.";
    }
  };
  // One line per distinct message (two unavailable items → one line).
  const errorLines = [];
  for (const e of errors) {
    const text = errorText(e);
    if (!errorLines.some((l) => l.text === text)) errorLines.push({ code: e.code, text });
  }

  const useMyLocation = async () => {
    setLocBusy(true);
    setLocErr("");
    try {
      const p = await getCurrentPosition();
      setForm((f) => ({ ...f, coords: p }));
    } catch (e) {
      setLocErr(e.message === "denied" ? "Location blocked — set it on the map instead" : "Couldn't get your location — set it on the map instead");
    }
    setLocBusy(false);
  };

  const branchPoint = branch?.lat != null && branch?.lng != null ? { lat: branch.lat, lng: branch.lng } : null;
  const originPoint = origin && origin.lat != null && origin.lng != null ? { lat: origin.lat, lng: origin.lng } : null;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitErr("");
    const body = {
      phone,
      project_id: projectId,
      branch_id: branch.id,
      catalog_id: catalogId || null,
      items: cartLines,
      fulfilment,
      order_id: orderId || null,
    };
    if (nameT) body.customer_name = nameT.slice(0, NAME_MAX);
    if (isDelivery) {
      body.delivery_address = addrT.slice(0, ADDR_MAX);
      body.customer_lat = form.coords.lat;
      body.customer_lng = form.coords.lng;
      body.customer_pincode = form.pincode.trim();
    }
    const r = await submitCart(body);
    if (r.ok && r.data) {
      setSubmitting(false);
      onSubmitted(r.data);
      return;
    }
    if (errorCode(r.data) === "order_not_editable") onOrderNotEditable();
    setSubmitErr(
      r.status === 0
        ? "Network error. Please check your connection and try again."
        : errorMessage(r.data, "Something went wrong placing your order. Please try again.")
    );
    setSubmitting(false);
    setRetry((n) => n + 1);
  };

  const money = (n) => formatMoney(currency, n);
  const fee = ready ? Number(quote.delivery_fee || 0) : 0;
  const deliveryAvailable = ready && quote.delivery?.available;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <button onClick={onBack} aria-label="Back to cart" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 leading-tight">Checkout</h2>
            <p className="text-xs text-gray-500 truncate">🏪 {branch?.name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Fulfilment toggle */}
          <div>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100">
              {[
                { key: "pickup", label: "🏃 Pickup", on: pickupOn },
                { key: "delivery", label: "🛵 Delivery", on: deliveryOn },
              ].map((o) => (
                <button
                  key={o.key}
                  disabled={!o.on}
                  onClick={() => setForm((f) => ({ ...f, fulfilment: o.key }))}
                  className="py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-40"
                  style={
                    fulfilment === o.key
                      ? { background: "white", color: "#111827", boxShadow: "0 1px 3px rgba(0,0,0,.12)" }
                      : { color: "#4b5563" }
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
            {!deliveryOn && <p className="text-xs text-gray-500 mt-1.5">Delivery not available at this branch</p>}
            {!pickupOn && <p className="text-xs text-gray-500 mt-1.5">Pickup not available at this branch</p>}
            {!isDelivery && branch?.prep_minutes ? (
              <p className="text-xs text-gray-500 mt-1.5">Ready in ~{branch.prep_minutes} min{branch.address ? ` · ${branch.address}` : ""}</p>
            ) : !isDelivery && branch?.address ? (
              <p className="text-xs text-gray-500 mt-1.5">Pick up at {branch.address}</p>
            ) : null}
          </div>

          {/* Name */}
          <label className="block">
            <span className="text-sm font-medium text-gray-800">
              Your name {isDelivery ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(optional)</span>}
            </span>
            <input
              type="text"
              autoComplete="name"
              maxLength={NAME_MAX}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Your name"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-base outline-none focus:border-gray-400"
            />
          </label>

          {isDelivery && (
            <div className="space-y-4">
              {/* Location */}
              <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                <p className="text-sm font-medium text-gray-800">
                  {form.coords
                    ? <>📍 Delivering to: pin set{ready && quote.delivery_distance_km != null ? ` (${formatKm(quote.delivery_distance_km)})` : ""}</>
                    : <>📍 Set delivery location <span className="text-red-500">*</span></>}
                </p>
                <div className="flex gap-2">
                  <button onClick={useMyLocation} disabled={locBusy}
                    className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium flex items-center justify-center gap-1.5">
                    {locBusy ? <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" /> : <Navigation size={14} />}
                    Use my location
                  </button>
                  <button onClick={() => setMapOpen(true)}
                    className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium flex items-center justify-center gap-1.5">
                    <MapIcon size={14} />{form.coords ? "Adjust on map" : "Pick on map"}
                  </button>
                </div>
                {locErr && <p className="text-xs text-red-600">{locErr}</p>}
              </div>

              <label className="block">
                <span className="text-sm font-medium text-gray-800">Pincode <span className="text-red-500">*</span></span>
                <input
                  type="text"
                  inputMode={india ? "numeric" : "text"}
                  autoComplete="postal-code"
                  maxLength={india ? 6 : 10}
                  value={form.pincode}
                  onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/[^0-9A-Za-z -]/g, "") }))}
                  placeholder={india ? "6-digit pincode" : "Postal code"}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-base outline-none focus:border-gray-400"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-800">Address <span className="text-red-500">*</span></span>
                <textarea
                  rows={3}
                  maxLength={ADDR_MAX}
                  autoComplete="street-address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="House / flat, street, landmark"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-base outline-none focus:border-gray-400 resize-none"
                />
                <span className="text-[11px] text-gray-400">{addrT.length}/{ADDR_MAX}</span>
              </label>
            </div>
          )}

          {/* Quote */}
          <div className="rounded-xl bg-gray-50 p-3 space-y-1.5 text-sm">
            {quoteState === "error" ? (
              <div className="flex items-center justify-between gap-2 text-gray-700">
                <span className="flex items-center gap-1.5"><AlertCircle size={14} className="text-red-500" />{quoteErr || "Couldn't calculate total"}</span>
                <button onClick={() => setRetry((n) => n + 1)} className="flex items-center gap-1 font-semibold" style={{ color: accent }}>
                  <RotateCw size={13} />Retry
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>{ready ? <span>{money(quote.subtotal)}</span> : <Skeleton />}
                </div>
                {(!ready || Number(quote.gst_percent) > 0) && (
                  <div className="flex justify-between text-gray-600">
                    <span>GST{ready ? ` (${quote.gst_percent}%)` : ""}</span>{ready ? <span>{money(quote.gst_amount)}</span> : <Skeleton />}
                  </div>
                )}
                {isDelivery && (
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery</span>
                    {!ready ? <Skeleton /> : !deliveryAvailable ? <span>—</span> : fee === 0 ? (
                      <span className="font-semibold text-green-700">FREE</span>
                    ) : (
                      <span>{money(fee)}{quote.delivery_distance_km != null ? ` · ${formatKm(quote.delivery_distance_km)}` : ""}</span>
                    )}
                  </div>
                )}
                {ready && isDelivery && deliveryAvailable && Number(quote.amount_to_free_delivery) > 0 && (
                  <p className="text-xs text-green-700">Add {money(quote.amount_to_free_delivery)} more for free delivery</p>
                )}
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1.5 border-t border-gray-200">
                  <span>Total</span>{ready ? <span>{money(quote.total)}</span> : <Skeleton />}
                </div>
              </>
            )}
          </div>

          {errorLines.length > 0 && (
            <div className="space-y-2">
              {errorLines.map((l) => (
                <div key={l.text} className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700 space-y-2">
                  <p>{l.text}</p>
                  {l.code === "out_of_area" && canChangeBranch && !locked && (
                    <button onClick={onChangeBranch} className="text-xs font-semibold underline">Change branch</button>
                  )}
                  {(l.code === "item_unavailable" || l.code === "item_not_on_menu") && hasItemProblem && (
                    <button
                      onClick={() => onKeepOnly(new Set((quote.items || []).map((i) => i.product_id)))}
                      className="text-xs font-semibold underline"
                    >
                      Remove unavailable items
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {fieldProblems.length > 0 && (
            <div className="text-xs text-gray-600">
              <p className="font-medium">To continue:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {fieldProblems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t space-y-2 bg-white">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full py-4 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: accent }}
          >
            {submitting ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</>
            ) : (
              <>📱 Continue to WhatsApp{ready && quote.ok ? ` · ${money(quote.total)}` : ""}</>
            )}
          </button>
          {!phone && <p className="text-xs text-red-500 text-center">Please open this link from WhatsApp</p>}
          {submitErr && <p className="text-xs text-red-600 text-center" role="alert">{submitErr}</p>}
        </div>
      </div>

      <MapModal
        open={mapOpen}
        title="Delivery location"
        accent={accent}
        initial={form.coords}
        center={form.coords || originPoint || branchPoint}
        markers={branchPoint ? [{ id: branch.id, lat: branchPoint.lat, lng: branchPoint.lng, label: branch.name }] : []}
        onClose={() => setMapOpen(false)}
        onConfirm={(p) => {
          setMapOpen(false);
          setForm((f) => ({ ...f, coords: p }));
        }}
      />
    </div>
  );
}
