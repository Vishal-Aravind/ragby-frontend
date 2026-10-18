// Checkout persistence for one tab: the form the customer typed, the cart,
// and the "pending" order (idempotency key + payment link) that lets a retry
// or a Back press from Razorpay land on the same order instead of a new one.
// Nothing here ever holds the customer token. sessionStorage can throw
// (private mode, blocked storage); every helper fails soft.

const checkoutKey = (pid) => `zavo_shop_checkout_${pid}`;
const pendingKey = (pid) => `zavo_shop_pending_${pid}`;
const cartKey = (pid) => `zavo_shop_cart_${pid}`;

function read(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const EMPTY_ADDRESS = { line1: "", line2: "", city: "", pincode: "" };
export const SOLD_OUT_PREFS = ["remove_item", "call_me", "merchant_choice"];

// ---- checkout form: {open, step, fulfilment, name, address, coords, coupon, soldOut, note}
export function readCheckout(pid) {
  const v = read(checkoutKey(pid));
  if (!v) return null;
  const a = v.address && typeof v.address === "object" ? v.address : {};
  const str = (x, max) => (typeof x === "string" ? x.slice(0, max) : "");
  const c = v.coords;
  return {
    open: v.open === true,
    step: [1, 2, 3, 4].includes(v.step) ? v.step : 1,
    fulfilment: v.fulfilment === "delivery" ? "delivery" : v.fulfilment === "pickup" ? "pickup" : null,
    name: str(v.name, 80),
    address: { line1: str(a.line1, 110), line2: str(a.line2, 110), city: str(a.city, 50), pincode: str(a.pincode, 10) },
    coords: c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)) ? { lat: Number(c.lat), lng: Number(c.lng) } : null,
    coupon: typeof v.coupon === "string" && v.coupon ? v.coupon.slice(0, 20) : null,
    soldOut: SOLD_OUT_PREFS.includes(v.soldOut) ? v.soldOut : "remove_item",
    note: str(v.note, 300),
  };
}

export const writeCheckout = (pid, value) => write(checkoutKey(pid), value);
export const clearCheckout = (pid) => write(checkoutKey(pid), null);

// ---- cart: {branchId, items: {productId: qty}, info: {productId: {name, price, image_url}}}
export function readCart(pid) {
  const v = read(cartKey(pid));
  if (!v || typeof v.branchId !== "string" || !v.items || typeof v.items !== "object") return null;
  const items = {};
  for (const [k, q] of Object.entries(v.items)) {
    const n = Math.floor(Number(q));
    if (n > 0 && n <= 999) items[k] = n;
  }
  return { branchId: v.branchId, items, info: v.info && typeof v.info === "object" ? v.info : {} };
}

export const writeCart = (pid, value) => write(cartKey(pid), value);
export const clearCart = (pid) => write(cartKey(pid), null);

// ---- pending order: {key, fingerprint, order_id, payment_url, expires_at, receipt, short_id, total}
export const readPending = (pid) => read(pendingKey(pid));
export const writePending = (pid, value) => write(pendingKey(pid), value);
export const clearPending = (pid) => write(pendingKey(pid), null);

/** True while the pending entry holds a payment link that is still usable. */
export function pendingLinkLive(p, now = Date.now()) {
  if (!p || !p.payment_url || !p.order_id) return false;
  const exp = Date.parse(p.expires_at || "");
  return Number.isFinite(exp) ? exp - 60000 > now : false;
}

/** Same coupon normalisation as the server (strip, remove spaces, upper). */
export function normalizeCode(raw) {
  if (typeof raw !== "string") return null;
  const c = raw.trim().replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{3,19}$/.test(c) ? c : null;
}

/**
 * Client-side checkout fingerprint over the same fields the server hashes.
 * It only decides whether to reuse the idempotency key; the server keeps its
 * own hash, so this does not need to match it byte for byte.
 */
export function checkoutFingerprint(d) {
  const items = [...(d.items || [])]
    .map((i) => [String(i.product_id), Number(i.quantity) || 0])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const del = d.fulfilment === "delivery";
  const a = d.address || {};
  return JSON.stringify([
    d.order_id || null,
    d.branch_id || null,
    items,
    d.fulfilment || null,
    (d.name || "").trim(),
    del ? [(a.line1 || "").trim(), (a.line2 || "").trim(), (a.city || "").trim(), (a.pincode || "").trim()] : null,
    del && d.coords ? [d.coords.lat, d.coords.lng] : null,
    normalizeCode(d.coupon || "") || null,
    d.soldOut || "remove_item",
    (d.note || "").trim(),
  ]);
}

// Same order_id (Add More target) and branch in two fingerprints: an order
// can't move branch, and an Add More edit is keyed by its order_id instead.
function sameOrderContext(a, b) {
  try {
    const x = JSON.parse(a);
    const y = JSON.parse(b);
    return Array.isArray(x) && Array.isArray(y) && x[0] === y[0] && x[1] === y[1];
  } catch {
    return false;
  }
}

export function newIdempotencyKey() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  const b = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * The key for this attempt. Reused when the cart/details are unchanged (a
 * retry), and also while the pending order still has a live payment link,
 * so the server can answer `payment_in_progress` instead of a second order
 * with a second link. It is also kept across edits while the pending order
 * never got a payment link (a rejected offer or coupon, a failed attempt, a
 * WhatsApp-confirm cart): the server finds that unplaced order by the key
 * and updates it instead of leaving it behind as an orphan. A placed order
 * answers `order_not_editable` to a changed checkout, which clears this
 * entry. Anything else gets a fresh key.
 */
export function keyForAttempt(pid, fingerprint) {
  const p = readPending(pid);
  if (p && typeof p.key === "string" && (p.fingerprint === fingerprint || pendingLinkLive(p))) {
    return { key: p.key, pending: p };
  }
  if (p && typeof p.key === "string" && !p.payment_url && sameOrderContext(p.fingerprint, fingerprint)) {
    const next = { ...p, fingerprint };
    writePending(pid, next);
    return { key: p.key, pending: next };
  }
  const key = newIdempotencyKey();
  const next = { key, fingerprint, order_id: null, payment_url: null, expires_at: null, receipt: null, short_id: null, total: null };
  writePending(pid, next);
  return { key, pending: next };
}

/** Pincode check matching the server's regions (India: 6 digits). */
export function pincodeLooksValid(pc, india) {
  const v = (pc || "").trim();
  return india ? /^[1-9]\d{5}$/.test(v) : /^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/.test(v);
}

/** Client copy of the place-order delivery validation (B.6). Returns {field: message}. */
export function validateDetails({ fulfilment, name, address, coords }, india) {
  const e = {};
  const n = (name || "").trim();
  if (!n) e.name = "Enter your name";
  else if (n.length > 80 || /[\r\n]/.test(n)) e.name = "Name must be one line, up to 80 characters";
  if (fulfilment === "delivery") {
    const a = address || {};
    const l1 = (a.line1 || "").trim();
    const l2 = (a.line2 || "").trim();
    const city = (a.city || "").trim();
    if (l1.length < 3) e.line1 = "Enter your house / flat and street";
    else if (l1.length > 110) e.line1 = "Keep this under 110 characters";
    if (l2.length > 110) e.line2 = "Keep this under 110 characters";
    if (city.length < 2) e.city = "Enter your city";
    else if (city.length > 50) e.city = "Keep this under 50 characters";
    if (!pincodeLooksValid(a.pincode, india)) e.pincode = india ? "Enter a 6-digit pincode" : "Enter a valid postal code";
    if (!e.line1 && !e.city && [l1, l2, city].filter(Boolean).join(", ").length < 10) {
      e.line1 = "Add a little more detail to your address";
    }
    if (!coords) e.map = "Set your delivery location on the map";
  }
  return e;
}
