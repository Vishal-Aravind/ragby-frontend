import { NextResponse } from "next/server";

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
 */
export async function proxyToBackend(path, { token, method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${BACKEND}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    console.error(`backend unreachable: ${path}`, e);
    return NextResponse.json(
      { detail: "We couldn't reach the billing service. Please try again in a moment." },
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
