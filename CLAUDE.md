# Zavo — frontend (Next.js)

## What this is
Zavo (`askzavo.com`) is a business-automation SaaS for small merchants, sold on
one pitch: **take orders and bookings on WhatsApp without paying Zomato/Swiggy
commission.** It started as a RAG chatbot and grew well past that.

Modules: Documents (RAG sources), Conversations, Flows (visual WhatsApp flow
builder), Leads, Campaigns, Templates, Shop (catalog → cart → Razorpay),
Appointments (Calendly-style, Google Calendar sync), Registrations (events +
drag-and-drop page builder), Analytics, Team.

Channels: WhatsApp, Telegram, Shopify storefront widget, embeddable website
widget. **No Slack** (only a leftover `slack_integrations` table).

## Two repos, not one
- This repo — Next.js frontend, deployed on **Vercel**.
- `backend/` — **a separate git repo** (FastAPI), deployed on **Render**.
  Changes there need their own commit and push.

Supabase migrations live in **this** repo under `supabase/migrations/`, even
though they are backend concerns. The user runs them by hand in the Supabase
SQL editor.

## Stack
Next.js 16 App Router + React 19 in `src/`. shadcn/Radix (`src/components/ui/`),
Tailwind v4, `@supabase/ssr` for auth, ReactFlow for the flow builder.

## API route patterns (`src/app/api/**`)
Two patterns, consistent across ~100 route files:
1. **Direct Supabase** — queries Supabase with the user's session cookie, RLS-scoped.
2. **JWT-forwarding proxy** — pulls the token via `getSupabase`/`getToken`
   (`src/lib/supabase-api.js`) and forwards it as `Authorization: Bearer` to FastAPI.

Authorization is enforced with `requireProjectTab(userId, projectId, {tab, minRole})`
in `src/lib/supabase-api.js`, mirroring the backend's `require_project_access`.
Roles rank owner(3) > admin(2) > agent(1). An agent gets Leads + Conversations by
default; other tabs are granted per-member. Team is owner/admin only and never grantable.

## Config
`NEXT_PUBLIC_APP_URL` = `https://askzavo.com`. Several dashboard pages (leads,
team, templates, analytics) fetch **server-side** against it, so it must point at
something that resolves or those pages break.

## Conventions
- **Verify JSX parses** after editing: `@babel/parser` with the `jsx` plugin.
  There is no CI — nothing else will catch a syntax error before deploy.
- Don't add comments that restate the code. Existing comments explain *why*
  (a past incident, a non-obvious constraint) — match that bar.
- Progressive disclosure in forms: show the few fields needed to create
  something, hide the rest behind an "Advanced options" `<details>`. The
  Services form in Appointments is the reference implementation.

## Hard rules
- **Never run Supabase queries directly**, even reads. Write the SQL and hand it
  to the user to run.
- **Don't ship unasked changes.** Propose extra fixes; only push what was requested.
