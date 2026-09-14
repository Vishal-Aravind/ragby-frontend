// Next.js calls register() once per runtime the app boots into. This is
// what actually loads sentry.server.config.js / sentry.edge.config.js —
// they are never imported directly, only reached through here.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config.js");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config.js");
  }
}

// Captures errors from nested React Server Components that Next.js's own
// error boundaries would otherwise swallow before they reach either
// config's global handlers.
export async function onRequestError(...args) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
