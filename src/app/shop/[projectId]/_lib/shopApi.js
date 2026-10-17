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
