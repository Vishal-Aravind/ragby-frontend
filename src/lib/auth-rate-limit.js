import { visitorHeaders } from "@/lib/visitor-ip";

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

/**
 * Ask the backend's brute-force limiter whether this attempt may proceed.
 *
 * Returns { allowed, reason }. `reason` is "limited" for a real 429 and
 * "unavailable" when the check could not run at all.
 *
 * Fails OPEN by design. The call used to be a bare unguarded fetch, so an
 * unreachable backend threw and login returned a 500 — nobody could sign in
 * even though Supabase Auth was perfectly healthy. A side service being
 * down must not take authentication down with it, and Supabase has its own
 * limits underneath. The skip is recorded so the gap is visible rather
 * than silent.
 *
 * It also used to treat ANY non-2xx as "too many attempts", so an unrelated
 * backend 500 told users they were rate limited, which was simply untrue.
 */
export async function checkAuthRateLimit(req, action, { identifier } = {}) {
  if (!BACKEND) {
    console.error(`auth rate limit: no backend configured, allowing ${action}`);
    return { allowed: true, reason: "unavailable" };
  }

  let res;
  try {
    res = await fetch(`${BACKEND}/auth/rate-limit-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...visitorHeaders(req) },
      body: JSON.stringify({ action, identifier }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error(`auth rate limit unreachable, allowing ${action}:`, e);
    return { allowed: true, reason: "unavailable" };
  }

  if (res.status === 429) return { allowed: false, reason: "limited" };

  if (!res.ok) {
    console.error(`auth rate limit returned ${res.status}, allowing ${action}`);
    return { allowed: true, reason: "unavailable" };
  }

  return { allowed: true };
}
