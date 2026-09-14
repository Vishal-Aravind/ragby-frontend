import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Silences the plugin's own build-time logging; Sentry SDK setup
  // problems still print, this just drops the routine noise.
  silent: true,

  // Source map upload needs an org slug, a project slug and a
  // SENTRY_AUTH_TOKEN (an auth token, not the DSN above) — none of which
  // are set here. Without them the plugin just skips the upload step, so
  // stack traces in Sentry show minified code until this is filled in.
  // org: "your-org-slug",
  // project: "your-project-slug",

  // Routes client-side Sentry requests through this app's own domain
  // (as /monitoring) rather than direct to ingest.*.sentry.io, so ad
  // blockers that block third-party error trackers don't silently drop
  // events. Adds one rewrite rule; no behavior change if unused.
  tunnelRoute: "/monitoring",

  // Automatically deletes source maps from the client bundle after
  // upload — irrelevant while upload is unconfigured (see above), but
  // harmless, and correct once org/project/authToken are added.
  widenClientFileUpload: true,

  webpack: {
    // Strips Sentry's own debug-log calls from the client bundle.
    // Replaces the deprecated top-level disableLogger option.
    treeshake: { removeDebugLogging: true },
    // Replaces the deprecated top-level automaticVercelMonitors option —
    // off, this app has no Vercel Cron jobs (the scheduler lives in the
    // backend). Neither option applies under Turbopack.
    automaticVercelMonitors: false,
  },
});
