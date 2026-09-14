// Browser-side Sentry init. Auto-loaded by @sentry/nextjs's build plugin —
// nothing imports this file explicitly, the SDK's webpack/turbopack
// injection wires it in on its own (see the "**/instrumentation-client.*"
// matcher the package ships).
//
// This is the frontend's first error-tracking setup at all: before this,
// every Next.js API route failure and every unhandled browser error was
// invisible unless someone happened to be watching console.error live.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Fraction of transactions sent for performance monitoring. Kept low —
  // this is a free-tier account, and transaction volume is a separate
  // quota from error events. 0.1 means one in ten page loads/navigations
  // gets traced; errors are always captured regardless of this setting.
  tracesSampleRate: 0.1,

  // Session Replay is a separate, larger quota again. Off by default;
  // only sampled for sessions that actually hit an error, so a normal
  // visit never records anything.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,

  integrations: [Sentry.replayIntegration()],

  // Quiets the SDK's own console output in production; leave debug logs
  // for local dev only.
  debug: false,
});

// Required export: without it the SDK cannot see App Router client-side
// navigations at all, so a page-to-page nav error (or its performance
// span) would never show up as a Sentry transaction.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
