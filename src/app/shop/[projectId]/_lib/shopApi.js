// Fetch helpers for the public shop page. Every helper resolves (never
// throws) to { ok, status, data }, with status 0 for a network failure, so
// callers can tell "the server said no" from "we never reached it".

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Customer-readable text from a backend error body (string or {code,message}). */
export function errorMessage(data, fallback = "Something went wrong. Please try again.") {
  if (!data) return fallback;
  const d = data.detail;
  if (typeof d === "string" && d) return d;
  if (d && typeof d.message === "string" && d.message) return d.message;
  if (Array.isArray(d) && d[0]?.msg) return fallback; // FastAPI validation noise
  if (typeof data.error === "string" && data.error) return data.error;
  return fallback;
}

export function errorCode(data) {
  const d = data?.detail;
  return d && typeof d === "object" && !Array.isArray(d) ? d.code || null : null;
}

async function call(url, { method = "GET", body } = {}) {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

const base = (pid) => `/api/public/shop/${encodeURIComponent(pid)}`;

function qs(pairs) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(pairs)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `&${s}` : "";
}

export const getConfig = (pid) => call(`${base(pid)}?type=config`);

export const getCatalogs = (pid, branchId) =>
  call(`${base(pid)}?type=catalogs${qs({ branch_id: branchId })}`);

export const getProducts = (pid, branchId, catalogId) =>
  call(`${base(pid)}?type=products${qs({ branch_id: branchId, catalog_id: catalogId })}`);

export const getBranchStatus = (pid, branchId) =>
  call(`${base(pid)}?type=status${qs({ branch_id: branchId })}`);

/** body: {} | {lat, lng} | {pincode} */
export const findBranches = (pid, body = {}) =>
  call(`${base(pid)}/branches`, { method: "POST", body });

export const getQuote = (pid, body) => call(`${base(pid)}/quote`, { method: "POST", body });

export const getOrder = (orderId, phone) =>
  call(
    `/api/public/shop/order/${encodeURIComponent(orderId)}?${new URLSearchParams({ phone: phone || "" })}`
  );

export const submitCart = (body) =>
  call(`/api/public/shop/submit-cart`, { method: "POST", body });

// ---- v3 -------------------------------------------------------------------
// The customer token only ever travels in POST bodies (never a URL), so it
// stays out of access logs and Referer headers.

export const getMe = (pid, customerToken) =>
  call(`${base(pid)}/me`, { method: "POST", body: { customer_token: customerToken } });

/** Public offers strip. No identity is sent; this is a plain GET. */
export const getOffers = (pid, branchId, fulfilment) =>
  call(`${base(pid)}?type=offers${qs({ branch_id: branchId, fulfilment })}`);

export const placeOrder = (pid, body) => call(`${base(pid)}/place-order`, { method: "POST", body });

export const getMyOrders = (pid, customerToken, limit = 20) =>
  call(`${base(pid)}/my-orders`, { method: "POST", body: { customer_token: customerToken, limit } });

/** auth: {receipt} or {customer_token} */
export const getOrderStatus = (pid, orderId, auth) =>
  call(`${base(pid)}/orders/${encodeURIComponent(orderId)}/status`, { method: "POST", body: auth });

/** The order's invoice (404 until it has one). auth: {receipt} or {customer_token} */
export const getInvoice = (pid, orderId, auth) =>
  call(`${base(pid)}/orders/${encodeURIComponent(orderId)}/invoice`, { method: "POST", body: auth });

/** Link to the printable invoice page. Without a receipt the page uses the
 * customer token from this tab's session. */
export function invoiceHref(pid, orderId, receipt) {
  const path = `/shop/${encodeURIComponent(pid)}/invoice/${encodeURIComponent(orderId)}`;
  return receipt ? `${path}?${new URLSearchParams({ r: receipt })}` : path;
}

export const cancelOrder = (pid, orderId, auth) =>
  call(`${base(pid)}/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST", body: auth });

/** Customer text for an offer reason code (B.2), when the server sent no message. */
export function offerReasonText(reason) {
  switch (reason) {
    case "invalid_code": return "This code isn't valid.";
    case "expired": return "This offer has expired.";
    case "not_started": return "This offer hasn't started yet.";
    case "paused": return "This offer isn't available right now.";
    case "branch": return "This offer isn't valid at this branch.";
    case "fulfilment": return "This offer isn't valid for this order type.";
    case "login_required": return "Open the menu from your WhatsApp chat to use this offer.";
    case "min_order": return "Add more items to use this offer.";
    case "limit_reached": return "This offer has been fully claimed.";
    case "already_used": return "You've already used this offer.";
    case "not_first_order": return "This offer is for your first order only.";
    case "no_saving": return "This offer doesn't lower your total yet.";
    case "rate_limited": return "Too many code attempts. Please try again in 15 minutes.";
    default: return "This offer can't be used on this order.";
  }
}

/** "17 Oct, 7:42 PM" in the viewer's own timezone. */
export function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date}, ${time.toUpperCase()}`;
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/** Remove params from the address bar without a navigation. */
export function stripUrlParams(names) {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const n of names) {
      if (url.searchParams.has(n)) {
        url.searchParams.delete(n);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch {
    /* ignore */
  }
}

export function openWhatsAppChat(storePhone) {
  const bizPhone = (storePhone || "").replace(/\D/g, "");
  window.location.href = `https://wa.me/${bizPhone || "15556458639"}`;
}

/** Promise wrapper around the browser geolocation API. Rejects with "denied" | "unavailable". */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
          lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
        }),
      (err) => reject(new Error(err && err.code === 1 ? "denied" : "unavailable")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

// sessionStorage can throw (private mode, blocked storage); the page must
// work without it.
const sessionKey = (pid) => `zavo_shop_${pid}`;

export function readSession(pid) {
  try {
    const raw = window.sessionStorage.getItem(sessionKey(pid));
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

export function writeSession(pid, value) {
  try {
    window.sessionStorage.setItem(sessionKey(pid), JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function formatMoney(currency, n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return `${currency}0`;
  return `${currency}${Number.isInteger(v) ? v : v.toFixed(2)}`;
}

export function formatKm(km) {
  const v = Number(km);
  if (km == null || !Number.isFinite(v)) return null;
  return v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1)} km`;
}

/** "Opens at 9:00 AM" / "Opens tomorrow at 9:00 AM" from a branch_status object. */
export function closedToastText(status) {
  if (!status) return "Not taking orders right now";
  if (status.reason === "paused") return "Not taking orders right now";
  if (status.reason === "inactive") return "This branch isn't taking orders";
  const o = status.opens_at_label;
  if (o) return /^\d/.test(o) ? `Opens at ${o}` : `Opens ${o}`;
  return status.label || "Closed now";
}

/** "#16a34a" + alpha "1a" → "#16a34a1a"; anything that isn't 6-digit hex falls back. */
export function withAlpha(hex, alpha, fallback = "transparent") {
  return typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : fallback;
}
