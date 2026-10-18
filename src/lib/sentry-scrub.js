// Removes the shop's bearer URL params before anything reaches Sentry.
//
// The customer shop link carries `t` (a signed customer token, valid for
// days) and the payment return carries `r` (an order receipt). The page
// strips both from the address bar on load, but the page-load transaction,
// request URLs and navigation breadcrumbs are recorded before that. Every
// string in the event is rewritten, so URLs nested in spans, breadcrumbs or
// request data are covered too.

const SECRET_PARAM_RE = /([?&](?:t|r)=)[^&#\s"']*/g;

export function scrubUrl(value) {
  return typeof value === "string" ? value.replace(SECRET_PARAM_RE, "$1[Filtered]") : value;
}

function scrubDeep(value, depth = 0) {
  if (typeof value === "string") return scrubUrl(value);
  if (!value || typeof value !== "object" || depth > 8) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = scrubDeep(value[i], depth + 1);
    return value;
  }
  for (const k of Object.keys(value)) value[k] = scrubDeep(value[k], depth + 1);
  return value;
}

export function scrubEvent(event) {
  try {
    return scrubDeep(event);
  } catch {
    return event;
  }
}

export function scrubBreadcrumb(breadcrumb) {
  try {
    return scrubDeep(breadcrumb);
  } catch {
    return breadcrumb;
  }
}
