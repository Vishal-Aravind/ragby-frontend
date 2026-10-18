"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ShieldCheck, Lock } from "lucide-react";
import Stepper from "./Stepper";
import StepCart from "./StepCart";
import StepOrderType from "./StepOrderType";
import StepDetails from "./StepDetails";
import StepSummary, { quoteErrorText } from "./StepSummary";
import {
  getQuote, placeOrder, cancelOrder, errorMessage, errorCode, formatMoney, closedToastText, offerReasonText,
} from "../_lib/shopApi";
import {
  checkoutFingerprint, keyForAttempt, readPending, writePending, clearPending, validateDetails, pincodeLooksValid,
} from "../_lib/checkoutState";

const DELIVERY_ERROR_CODES = new Set(["out_of_area", "location_required", "delivery_off", "fulfilment_unavailable"]);

const isHttpsUrl = (u) => {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Full-screen 4-step checkout: Cart → Order type → Details → Summary.
 *
 * Money: every amount charged comes from POST /quote or the place-order
 * response. The page sends only ids, quantities, the coupon code and
 * `expected_total` (which the server uses only to reject a mismatch).
 *
 * Idempotency: one key per checkout fingerprint (see checkoutState), so a
 * double tap, a retry after a network drop, or a Back press from Razorpay
 * all land on the same order and the same payment link.
 */
export default function CheckoutFlow({
  projectId, token, identity, effectivePhone, branch, status, currency, accent, india, origin,
  canChangeBranch, items, cartLines, catalogId, orderId,
  form, setForm, checkout, setCheckout, pendingCode, onPendingCodeUsed, freeDeliveryOffer,
  onClose, onChangeBranch, onAdd, onRemove, onKeepOnly, onOrderNotEditable, onVerifiedLost,
  onPlaced, onConfirmInWhatsApp, onBeforeRedirect,
}) {
  const step = checkout.step;
  const setStep = useCallback((n) => setCheckout((c) => ({ ...c, step: n })), [setCheckout]);
  const fulfilment = form.fulfilment;
  const isDelivery = fulfilment === "delivery";
  const canOrder = status ? status.can_order !== false : true;

  const [quote, setQuote] = useState(null);
  const [quoteState, setQuoteState] = useState("idle"); // idle | loading | ready | error
  const [quoteErr, setQuoteErr] = useState("");
  const [quotedKey, setQuotedKey] = useState(null);
  const seq = useRef(0);

  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [deliveryError, setDeliveryError] = useState(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponMessage, setCouponMessage] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null); // {text, retry: bool}
  const [inProgress, setInProgress] = useState(null); // payment_in_progress detail
  const [redirecting, setRedirecting] = useState(false);
  const submittingRef = useRef(false);

  // Full-screen: keep the menu underneath from scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // If the chosen type is off at this branch, fall back to the other one.
  const pickupOn = !!branch?.pickup_enabled;
  const deliveryOn = !!branch?.delivery_available;
  useEffect(() => {
    if (fulfilment === "delivery" && !deliveryOn && pickupOn) setForm((f) => ({ ...f, fulfilment: "pickup" }));
    if (fulfilment === "pickup" && !pickupOn && deliveryOn) setForm((f) => ({ ...f, fulfilment: "delivery" }));
  }, [fulfilment, pickupOn, deliveryOn, setForm]);

  // ---- quote ------------------------------------------------------------------
  const buildQuoteBody = useCallback(
    (code) => {
      const body = {
        branch_id: branch?.id,
        items: cartLines,
        fulfilment,
        customer_token: token || null,
        coupon_code: code || null,
      };
      if (isDelivery) {
        if (form.coords) {
          body.customer_lat = form.coords.lat;
          body.customer_lng = form.coords.lng;
        }
        if (pincodeLooksValid(form.address?.pincode, india)) body.customer_pincode = form.address.pincode.trim();
      }
      return body;
    },
    [branch?.id, cartLines, fulfilment, token, isDelivery, form.coords, form.address?.pincode, india]
  );
  const currentKey = useMemo(() => JSON.stringify(buildQuoteBody(checkout.coupon)), [buildQuoteBody, checkout.coupon]);

  /** Quote with `code`; applies coupon feedback. Resolves to the quote, or null. */
  const runQuote = useCallback(
    async (code) => {
      const body = buildQuoteBody(code);
      const my = ++seq.current;
      setQuoteState("loading");
      const r = await getQuote(projectId, body);
      if (my !== seq.current) return null; // a newer quote is on its way
      if (!r.ok || !r.data) {
        setQuoteState("error");
        setQuoteErr(r.status >= 400 && r.status < 500 ? errorMessage(r.data) : "");
        return null;
      }
      const q = r.data;
      let keptCode = code || null;
      const c = q.coupon;
      if (code && c) {
        if (c.status === "applied") setCouponMessage(null);
        else {
          keptCode = null;
          setCouponMessage({
            tone: c.status === "not_better" ? "info" : "error",
            text: c.message || offerReasonText(c.reason),
          });
        }
      } else if (code && !c && !q.offer) {
        keptCode = null;
        setCouponMessage({ tone: "error", text: offerReasonText("invalid_code") });
      }
      setCheckout((s) => (s.coupon === keptCode ? s : { ...s, coupon: keptCode }));
      setQuote(q);
      setQuotedKey(JSON.stringify(buildQuoteBody(keptCode)));
      setQuoteState("ready");
      setQuoteErr("");
      if (identity?.verified && q.verified === false) onVerifiedLost();
      return q;
    },
    [buildQuoteBody, projectId, identity?.verified, onVerifiedLost, setCheckout]
  );

  // Entering Summary: apply a code tapped in the offers strip, else re-quote
  // whenever what we last quoted no longer matches the checkout.
  const canOrderNow = status?.can_order;
  useEffect(() => {
    if (step !== 4) return;
    if (pendingCode) onPendingCodeUsed();
    if (pendingCode && pendingCode !== checkout.coupon) {
      const code = pendingCode;
      setCouponBusy(true);
      setCouponMessage(null);
      setCheckout((c) => ({ ...c, coupon: code }));
      runQuote(code).finally(() => setCouponBusy(false));
      return;
    }
    if (quotedKey !== currentKey && quoteState !== "loading") runQuote(checkout.coupon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, currentKey, pendingCode]);

  // Open/closed flipped while on Summary: the quote's errors change with it.
  useEffect(() => {
    if (step === 4 && quoteState === "ready") runQuote(checkout.coupon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canOrderNow]);

  // ---- step actions -------------------------------------------------------------
  const fieldErrors = validateDetails(form, india);
  const visibleFieldErrors = showFieldErrors ? fieldErrors : {};

  const continueFromDetails = async () => {
    setShowFieldErrors(true);
    setDeliveryError(null);
    if (Object.keys(fieldErrors).length > 0) {
      toast.error("Please fill in the highlighted fields", { id: "details-missing" });
      return;
    }
    setDetailsBusy(true);
    const q = await runQuote(checkout.coupon);
    setDetailsBusy(false);
    if (!q) {
      setDeliveryError({ code: "network", text: "Couldn't check your address. Please try again." });
      return;
    }
    const del = (q.errors || []).find((e) => DELIVERY_ERROR_CODES.has(e.code));
    if (del && isDelivery) {
      setDeliveryError({ code: del.code, text: quoteErrorText(del, status) });
      return;
    }
    setStep(4);
  };

  const pickFulfilment = (key) => {
    setForm((f) => ({ ...f, fulfilment: key }));
    setDeliveryError(null);
    setShowFieldErrors(false);
    setStep(3);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
    else onClose();
  };

  // ---- coupon -----------------------------------------------------------------------
  const applyCoupon = async (raw) => {
    const code = (raw || "").trim().replace(/\s+/g, "").toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    setCouponMessage(null);
    setCheckout((s) => ({ ...s, coupon: code }));
    await runQuote(code);
    setCouponBusy(false);
  };
  const removeCoupon = async () => {
    setCouponBusy(true);
    setCouponMessage(null);
    setCheckout((s) => ({ ...s, coupon: null }));
    await runQuote(null);
    setCouponBusy(false);
  };

  // ---- place order ----------------------------------------------------------------
  const mode = quote?.checkout_mode || "confirm_in_whatsapp";
  const quoteFresh = quoteState === "ready" && quote && quotedKey === currentKey;
  const placeBlockedReason = !effectivePhone
    ? "Open this menu from your WhatsApp chat to order"
    : !canOrder
      ? closedToastText(status)
      : null;
  const canPlace = quoteFresh && quote.ok && !!effectivePhone && !submitting && !redirecting && !couponBusy;

  const fingerprintData = () => ({
    order_id: orderId || null,
    branch_id: branch?.id,
    items: cartLines,
    fulfilment,
    name: form.name,
    address: form.address,
    coords: form.coords,
    coupon: checkout.coupon,
    soldOut: checkout.soldOut,
    note: checkout.note,
  });

  const adoptQuote = (q, code) => {
    if (!q || typeof q !== "object") return false;
    seq.current++; // any quote still in flight is now stale
    setQuote(q);
    setQuotedKey(JSON.stringify(buildQuoteBody(code)));
    setQuoteState("ready");
    return true;
  };

  const goToPayment = (url) => {
    setRedirecting(true);
    onBeforeRedirect();
    window.location.assign(url);
  };

  const place = async ({ forceNewKey = false, dropOrderId = false } = {}) => {
    if (submittingRef.current) return;
    if (!canPlace && !forceNewKey) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitErr(null);

    const useOrderId = dropOrderId ? null : orderId || null;
    const fpData = { ...fingerprintData(), order_id: useOrderId };
    const fp = checkoutFingerprint(fpData);
    if (forceNewKey) clearPending(projectId);
    const { key } = keyForAttempt(projectId, fp);

    const body = {
      customer_token: token || null,
      phone: effectivePhone || null,
      idempotency_key: key,
      order_id: useOrderId,
      branch_id: branch.id,
      catalog_id: catalogId || null,
      items: cartLines,
      fulfilment,
      customer_name: (form.name || "").trim(),
      address: isDelivery
        ? {
            line1: (form.address.line1 || "").trim(),
            line2: (form.address.line2 || "").trim(),
            city: (form.address.city || "").trim(),
            pincode: (form.address.pincode || "").trim(),
          }
        : null,
      customer_lat: isDelivery && form.coords ? form.coords.lat : null,
      customer_lng: isDelivery && form.coords ? form.coords.lng : null,
      coupon_code: checkout.coupon || null,
      sold_out_preference: checkout.soldOut || "remove_item",
      note: (checkout.note || "").trim() || null,
      expected_total: Number(quote?.total),
    };

    const r = await placeOrder(projectId, body);
    const d = r.data || {};
    const finish = () => {
      submittingRef.current = false;
      setSubmitting(false);
    };

    if (r.ok && d.state) {
      const base = {
        key,
        fingerprint: fp,
        order_id: d.order_id || null,
        receipt: d.receipt || null,
        short_id: d.short_id || null,
        total: d.totals?.total ?? null,
      };
      if (d.state === "payment_required" && d.payment_url && isHttpsUrl(d.payment_url)) {
        writePending(projectId, { ...base, payment_url: d.payment_url, expires_at: d.payment_expires_at || null });
        finish();
        goToPayment(d.payment_url);
        return;
      }
      if (d.state === "placed" || d.state === "already_placed") {
        clearPending(projectId);
        finish();
        onPlaced(d);
        return;
      }
      if (d.state === "confirm_in_whatsapp") {
        // The order is a WhatsApp cart now; an edit + resubmit keeps the key
        // (see keyForAttempt), so the server updates this same order.
        writePending(projectId, { ...base, payment_url: null, expires_at: null });
        finish();
        onConfirmInWhatsApp(d);
        return;
      }
      finish();
      setSubmitErr({ text: "Something went wrong placing your order. Please try again.", retry: true });
      return;
    }

    finish();
    if (r.status === 0) {
      setSubmitErr({ text: "Network error. Check your connection and tap Try again — you won't be charged twice.", retry: true });
      return;
    }
    const code = errorCode(d);
    const detail = d.detail && typeof d.detail === "object" ? d.detail : {};
    switch (code) {
      case "price_changed":
        adoptQuote(detail.quote, checkout.coupon);
        toast("Prices or offers changed — please check the total", { id: "price-changed" });
        return;
      case "coupon_invalid":
      case "offer_unavailable":
        setCheckout((s) => ({ ...s, coupon: null }));
        if (!adoptQuote(detail.quote, null)) runQuote(null);
        setCouponMessage({ tone: "error", text: detail.message || offerReasonText(detail.reason) });
        toast("That offer couldn't be used — please check the new total", { id: "offer-changed" });
        return;
      case "payment_in_progress":
        setInProgress({
          order_id: detail.order_id || null,
          payment_url: detail.payment_url && isHttpsUrl(detail.payment_url) ? detail.payment_url : null,
          payment_expires_at: detail.payment_expires_at || null,
        });
        return;
      case "idempotency_conflict":
        // The kept key belongs to an order this caller can't edit (e.g. a
        // different number); the next tap starts a fresh order.
        clearPending(projectId);
        setSubmitErr({ text: errorMessage(d, "Please try again."), retry: true });
        return;
      case "order_not_editable":
        onOrderNotEditable();
        clearPending(projectId);
        setSubmitErr({ text: "That order is already being processed. Tap the button again to place a new order.", retry: false });
        return;
      case "payment_unavailable": {
        const p = readPending(projectId);
        if (p && p.key === key && detail.order_id) writePending(projectId, { ...p, order_id: detail.order_id });
        setSubmitErr({ text: errorMessage(d, "Couldn't start the payment. Please try again."), retry: true });
        return;
      }
      case "token_required":
        setSubmitErr({ text: errorMessage(d, "Open this menu from your WhatsApp chat to order."), retry: false });
        return;
      case "rate_limited":
        setSubmitErr({ text: errorMessage(d, "Too many attempts. Please wait a minute and try again."), retry: false });
        return;
      default:
        setSubmitErr({
          text: errorMessage(d, "Something went wrong placing your order. Please try again."),
          retry: r.status >= 500,
        });
        // Business-rule errors (closed, out of area, below minimum...) show up in a fresh quote too.
        if (r.status >= 400 && r.status < 500) runQuote(checkout.coupon);
    }
  };

  // payment_in_progress → "Cancel that payment & edit"
  const [cancelBusy, setCancelBusy] = useState(false);
  const cancelThatPayment = async () => {
    if (!inProgress?.order_id) return;
    setCancelBusy(true);
    const p = readPending(projectId);
    const auth = p && p.order_id === inProgress.order_id && p.receipt ? { receipt: p.receipt } : token ? { customer_token: token } : null;
    if (!auth) {
      setCancelBusy(false);
      setInProgress(null);
      setSubmitErr({ text: "We couldn't cancel that payment from here. Pay it, or message the store on WhatsApp.", retry: false });
      return;
    }
    const r = await cancelOrder(projectId, inProgress.order_id, auth);
    setCancelBusy(false);
    if (!r.ok) {
      setInProgress(null);
      setSubmitErr({
        text: errorCode(r.data) === "order_not_cancellable"
          ? "That order is already being processed and can't be cancelled here."
          : errorMessage(r.data, "Couldn't cancel that payment. Please try again."),
        retry: false,
      });
      return;
    }
    const wasEditing = orderId && orderId === inProgress.order_id;
    setInProgress(null);
    clearPending(projectId);
    if (wasEditing) onOrderNotEditable({ silent: true });
    toast.success("Previous payment cancelled", { id: "pay-cancelled" });
    place({ forceNewKey: true, dropOrderId: !!wasEditing });
  };

  // ---- render -------------------------------------------------------------------------
  const money = (n) => formatMoney(currency, n);
  const localTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = quote ? Number(quote.total) : null;

  let primary = null;
  if (step === 1) {
    primary = (
      <FooterButton
        accent={canOrder ? accent : "#9ca3af"}
        disabled={items.length === 0}
        onClick={() => (canOrder ? setStep(2) : toast(closedToastText(status), { id: "closed" }))}
        label={canOrder ? `Continue · ${money(localTotal)}` : closedToastText(status)}
      />
    );
  } else if (step === 2) {
    const valid = (fulfilment === "pickup" && pickupOn) || (fulfilment === "delivery" && deliveryOn);
    primary = valid ? <FooterButton accent={accent} onClick={() => pickFulfilment(fulfilment)} label="Continue" /> : null;
  } else if (step === 3) {
    primary = <FooterButton accent={accent} busy={detailsBusy} onClick={continueFromDetails} label="Continue" />;
  } else if (step === 4) {
    let label = "Continue on WhatsApp";
    let sub = "Confirm your order in WhatsApp. Offers need the link from your WhatsApp chat.";
    const amount = quoteFresh && Number.isFinite(total) ? money(total) : "";
    if (mode === "pay_online" && total === 0) {
      label = "Place order";
      sub = "Nothing to pay";
    } else if (mode === "pay_online") {
      label = amount ? `Pay ${amount}` : "Pay";
      sub = null;
    } else if (mode === "place_offline") {
      label = total === 0 ? "Place order" : amount ? `Place order · ${amount}` : "Place order";
      sub = total === 0 ? "Nothing to pay" : isDelivery ? "Pay on delivery" : "Pay at pickup";
    }
    primary = (
      <div className="space-y-1.5">
        {submitErr && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700 flex items-center justify-between gap-2" role="alert">
            <span>{submitErr.text}</span>
            {submitErr.retry && (
              <button onClick={() => place()} disabled={!canPlace} className="font-semibold underline shrink-0 disabled:opacity-50">
                Try again
              </button>
            )}
          </div>
        )}
        {placeBlockedReason && <p className="text-xs text-red-600 text-center">{placeBlockedReason}</p>}
        <FooterButton
          accent={accent}
          disabled={!canPlace}
          busy={submitting}
          busyLabel="Placing your order…"
          onClick={() => place()}
          label={label}
          icon={mode === "pay_online" && total !== 0 ? <Lock size={16} /> : null}
        />
        {sub && <p className="text-[11px] text-gray-500 text-center">{sub}</p>}
        {mode === "pay_online" && total !== 0 && (
          <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
            <ShieldCheck size={12} /> Secure payment by Razorpay
          </p>
        )}
      </div>
    );
  }

  const freeDelivery = freeDeliveryOffer || (quote?.available_offers || []).some((o) => o.kind === "free_delivery" && o.eligible);

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "#f8faf8" }} role="dialog" aria-modal="true" aria-label="Checkout">
      <div className="bg-white">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
          <button onClick={goBack} aria-label={step > 1 ? "Back" : "Close checkout"} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <ChevronLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 leading-tight">Checkout</h2>
            <p className="text-xs text-gray-500 truncate">🏪 {branch?.name}</p>
          </div>
        </div>
        <Stepper step={step} accent={accent} onGo={setStep} />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-xl mx-auto">
          {step === 1 && (
            <StepCart items={items} currency={currency} accent={accent} canOrder={canOrder} onAdd={onAdd} onRemove={onRemove} onBrowse={onClose} />
          )}
          {step === 2 && (
            <StepOrderType branch={branch} fulfilment={fulfilment} accent={accent} currency={currency} freeDeliveryOffer={freeDelivery} onPick={pickFulfilment} />
          )}
          {step === 3 && (
            <StepDetails
              branch={branch}
              fulfilment={fulfilment}
              form={form}
              setForm={(fn) => {
                setDeliveryError(null);
                setForm(fn);
              }}
              errors={visibleFieldErrors}
              deliveryError={deliveryError}
              india={india}
              accent={accent}
              origin={origin}
              canChangeBranch={canChangeBranch}
              onChangeBranch={onChangeBranch}
              onTryPickup={() => pickFulfilment("pickup")}
            />
          )}
          {step === 4 && (
            <StepSummary
              items={items}
              branch={branch}
              fulfilment={fulfilment}
              form={form}
              quote={quote}
              quoteState={quoteFresh || quoteState !== "ready" ? quoteState : "loading"}
              quoteErr={quoteErr}
              status={status}
              currency={currency}
              accent={accent}
              couponBusy={couponBusy}
              couponMessage={couponMessage}
              couponDisabledText={
                quoteFresh && mode === "confirm_in_whatsapp"
                  ? "Offers work when you open the menu from your WhatsApp chat."
                  : null
              }
              onApplyCoupon={applyCoupon}
              onRemoveCoupon={removeCoupon}
              soldOut={checkout.soldOut}
              setSoldOut={(v) => setCheckout((s) => ({ ...s, soldOut: v }))}
              note={checkout.note}
              setNote={(v) => setCheckout((s) => ({ ...s, note: v.slice(0, 300) }))}
              onRetryQuote={() => runQuote(checkout.coupon)}
              onGo={setStep}
              onKeepOnly={onKeepOnly}
            />
          )}
        </div>
      </div>

      {primary && (
        <div className="bg-white border-t border-gray-100 px-4 pt-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          <div className="max-w-xl mx-auto">{primary}</div>
        </div>
      )}

      {inProgress && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-6" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 space-y-3 shadow-xl">
            <h3 className="font-bold text-gray-900 text-lg">Payment already started</h3>
            <p className="text-sm text-gray-600">
              You already started paying for order #{shortOf(inProgress.order_id, projectId)}. Finish that payment, or cancel it to change your order.
            </p>
            {inProgress.payment_url && (
              <button
                onClick={() => {
                  const p = readPending(projectId);
                  if (p && p.order_id === inProgress.order_id) {
                    writePending(projectId, { ...p, payment_url: inProgress.payment_url, expires_at: inProgress.payment_expires_at || p.expires_at });
                  }
                  setInProgress(null);
                  goToPayment(inProgress.payment_url);
                }}
                className="w-full py-3 rounded-xl text-white font-semibold"
                style={{ background: accent }}
              >
                Pay now
              </button>
            )}
            <button
              onClick={cancelThatPayment}
              disabled={cancelBusy}
              className="w-full py-3 rounded-xl border border-gray-200 font-semibold text-gray-800 disabled:opacity-60"
            >
              {cancelBusy ? "Cancelling…" : "Cancel that payment & edit"}
            </button>
            <button onClick={() => setInProgress(null)} className="w-full py-2 text-sm font-semibold text-gray-500">
              Keep it
            </button>
          </div>
        </div>
      )}

      {redirecting && (
        <div className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-12 h-12 rounded-full animate-spin" style={{ border: "3px solid #e5e7eb", borderTopColor: accent }} />
          <p className="font-semibold text-gray-900">Taking you to secure payment…</p>
          <p className="text-xs text-gray-500 flex items-center gap-1"><ShieldCheck size={13} /> Payments are handled by Razorpay</p>
        </div>
      )}
    </div>
  );
}

function shortOf(orderId, projectId) {
  const p = readPending(projectId);
  if (p && p.order_id === orderId && p.short_id) return p.short_id;
  return orderId ? String(orderId).replace(/-/g, "").slice(0, 8).toUpperCase() : "";
}

function FooterButton({ label, onClick, disabled, busy, busyLabel = "Checking…", accent, icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="w-full py-3.5 rounded-xl text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99] transition"
      style={{ background: accent }}
    >
      {busy ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {busyLabel}
        </>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  );
}
