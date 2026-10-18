// Customer identity for the shop page.
//
// The WhatsApp link carries a signed token `t`. It is kept in sessionStorage
// only (never localStorage, never a GET URL), stripped from the address bar
// as soon as it is read, and sent to the backend only inside POST bodies.

import { getMe, stripUrlParams } from "./shopApi";

const tokenKey = (pid) => `zavo_shop_t_${pid}`;
const TOKEN_MAX = 512;

export function readToken(pid) {
  try {
    const v = window.sessionStorage.getItem(tokenKey(pid));
    return v && v.length <= TOKEN_MAX ? v : null;
  } catch {
    return null;
  }
}

export function storeToken(pid, token) {
  try {
    if (token) window.sessionStorage.setItem(tokenKey(pid), token);
    else window.sessionStorage.removeItem(tokenKey(pid));
  } catch {
    /* ignore */
  }
}

export const UNVERIFIED = { verified: false, phone: null, phone_masked: null, last_details: null, reason: "missing" };

/**
 * Store a fresh `t` from the URL, remove it from the address bar, then ask
 * the server who it belongs to. Resolves to
 *   { token, identity: {verified, phone, phone_masked, last_details, reason} }
 * `token` is null when the server rejected it (so it is not sent again).
 * A network failure keeps the token: the server re-checks it on every call.
 */
export async function bootIdentity(pid, urlToken) {
  if (urlToken && urlToken.length <= TOKEN_MAX) storeToken(pid, urlToken);
  if (urlToken) stripUrlParams(["t"]);

  const token = readToken(pid);
  if (!token) return { token: null, identity: UNVERIFIED };

  const r = await getMe(pid, token);
  if (r.ok && r.data && r.data.verified === true && r.data.phone) {
    stripUrlParams(["phone"]);
    return {
      token,
      identity: {
        verified: true,
        phone: String(r.data.phone),
        phone_masked: r.data.phone_masked || null,
        last_details: r.data.last_details && typeof r.data.last_details === "object" ? r.data.last_details : null,
        reason: null,
      },
    };
  }
  if (r.ok && r.data && r.data.verified === false) {
    storeToken(pid, null);
    return { token: null, identity: { ...UNVERIFIED, reason: r.data.reason || "malformed" } };
  }
  // Network / 5xx / 429: unknown. Keep the token; treat as not verified for now.
  return { token, identity: { ...UNVERIFIED, reason: "unavailable" } };
}
