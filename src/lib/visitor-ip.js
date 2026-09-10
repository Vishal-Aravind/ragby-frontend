/**
 * Headers that tell the backend who the real visitor is.
 *
 * Every route here used to forward the browser's own X-Forwarded-For value
 * as the sole such header. That does nothing useful: our host appends its
 * own address, and the backend deliberately trusts only the rightmost hop
 * because anything earlier is client-spoofable. The rightmost hop on these
 * paths is this frontend's egress IP — the same for every visitor — so
 * every IP-keyed rate limit in the app collapsed into one global bucket,
 * including the login brute-force limiter.
 *
 * X-Visitor-IP carries the real address, and the shared secret proves the
 * header came from us rather than from a caller hitting the backend
 * directly. The backend ignores it unless the secret matches and the value
 * parses as an IP (see client_ip in backend/ratelimit.py).
 *
 * With INTERNAL_PROXY_SECRET unset, this sends nothing extra and the
 * backend keeps its previous behaviour, so deploying ahead of the env var
 * is safe.
 */
export function visitorHeaders(req) {
  // The FIRST hop is the one our own edge recorded for the browser. That
  // is untrusted in general, but the backend is not taking our word for
  // it blindly — the secret is what makes it trustworthy, and we are the
  // only party positioned to know the visitor's address at all.
  const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const secret = process.env.INTERNAL_PROXY_SECRET;

  if (!visitorIp || !secret) return {};

  return {
    "X-Visitor-IP": visitorIp,
    "X-Internal-Proxy-Secret": secret,
  };
}
