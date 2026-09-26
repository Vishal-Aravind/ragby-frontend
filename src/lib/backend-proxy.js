import { NextResponse } from "next/server";
import { visitorHeaders } from "@/lib/visitor-ip";

// Every billing route resolved only BACKEND_BASE_URL, while the rest of the
// app resolves this chain. One name missing in an environment meant
// "undefined/billing/plan" and a fetch that always failed.
export const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_BASE_URL;

/**
 * Forward an authenticated request to the FastAPI backend and return its
 * response as JSON.
 *
 * Every billing route used to do `NextResponse.json(await res.json())` with
 * no try/catch and no res.ok check. A backend 502 or an HTML error page made
 * res.json() throw INSIDE the route, so the customer saw nothing at all —
 * on the one screen where they are trying to pay us.
 *
 * The backend signals errors as {detail: "..."} (FastAPI's HTTPException
 * shape) and the account page reads `data.detail`, so that key is preserved
 * verbatim; these messages are written for the customer.
 *
 * `token` is optional so the unauthenticated /public/* routes can use this
 * too. Pass `req` on those: it forwards the real visitor address via
 * visitorHeaders. Without it the backend's client_ip() sees only this
 * frontend's egress IP, so every visitor of every project shares one
 * rate-limit bucket — on the booking page that meant roughly ten concurrent
 * visitors could 429 each other off the slots endpoint.
 */
export async function proxyToBackend(
  path,
  { token, req, method = "GET", body, timeoutMs = 30000 } = {}
) {
  // FormData (multipart uploads) must NOT be JSON-stringified and must NOT
  // get a manual Content-Type — fetch sets its own with the multipart
  // boundary, and hand-setting it here strips that boundary, corrupting
  // the body on the receiving end.
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  let res;
  try {
    res = await fetch(`${BACKEND}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(req ? visitorHeaders(req) : {}),
        ...(body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: isFormData ? body : JSON.stringify(body) } : {}),
      // Without this a slow (not even down) backend pins the Next.js
      // request until the platform's own timeout kills it, and the user
      // watches a spinner with no error the whole time.
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    console.error(`backend unreachable: ${path}`, e);
    // Was worded as "the billing service", which is what Shopify and every
    // later caller of this helper also showed.
    return NextResponse.json(
      { detail: "We couldn't reach the server. Please try again in a moment." },
      { status: 502 }
    );
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(`backend returned non-JSON: ${path}`, res.status, text.slice(0, 500));
    return NextResponse.json(
      { detail: "Something went wrong. Please try again." },
      { status: res.status >= 400 ? res.status : 502 }
    );
  }

  return NextResponse.json(data, { status: res.status });
}
