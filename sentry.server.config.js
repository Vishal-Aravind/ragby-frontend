// Sentry init for the Node.js server runtime — every Next.js API route
// under src/app/api/**, server components, and route handlers. Loaded
// from instrumentation.js's register(), never imported directly.
import * as Sentry from "@sentry/nextjs";
import { scrubEvent, scrubBreadcrumb } from "@/lib/sentry-scrub";

Sentry.init({
  // Server code, unlike the browser bundle, doesn't need the NEXT_PUBLIC_
  // prefix to see this — but it's kept on the same var name as the client
  // and edge configs so all three always point at one project.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Same reasoning as instrumentation-client.js: kept low to protect the
  // free-tier transaction quota, separate from the error-event quota.
  tracesSampleRate: 0.1,

  debug: false,

  // The shop link's customer token (?t=) and payment receipt (?r=) are
  // bearer credentials; keep them out of every event, trace and breadcrumb.
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
});
