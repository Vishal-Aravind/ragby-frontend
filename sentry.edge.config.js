// Sentry init for the Edge runtime — src/proxy.js (this project's
// middleware-equivalent, renamed under Next.js 16) and any route declaring
// `export const runtime = "edge"`. Loaded from instrumentation.js's
// register(), never imported directly.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Same reasoning as the other two configs: kept low to protect the
  // free-tier transaction quota.
  tracesSampleRate: 0.1,

  debug: false,
});
