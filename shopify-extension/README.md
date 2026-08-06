# Ragby Chat Widget — Shopify Theme App Extension

This is the storefront-embedded version of the chat widget (Piece 3 of the
Shopify integration), delivered as a Shopify **Theme App Extension** / **App
Embed Block** rather than the manual `<script>` tag used by
`backend/static/widget.js` — Shopify is actively sunsetting manual
`<script>`-tag embedding (the ScriptTag API), and this is confirmed as
literally how comparable apps (e.g. Omakase.ai) are installed today: a
merchant toggles it on from their theme editor's "App Embeds" panel, no code
editing required.

**Honest caveat**: this was written from Shopify's documented Theme App
Extension conventions, without access to the Shopify CLI to actually
scaffold, validate, or deploy it. The `shopify.extension.toml` / Liquid
schema shape here is my best-effort match to Shopify's documented format —
treat it as a strong starting point to run through the real CLI, not as
something guaranteed to deploy as-is. Everything backend-side that this
extension talks to (`/public/chat`, `/public/shopify/cart-status/{chat_id}`)
*has* been verified by compiling and is exercised by the same code paths the
already-working generic widget uses.

## What's here

```
extensions/
  ragby-chat-widget/
    shopify.extension.toml       — extension metadata
    blocks/
      app-embed.liquid           — the app embed block (Liquid + settings schema)
    assets/
      ragby-chat-widget.js       — the actual widget script
```

## How to actually get this running

1. You need a local Shopify CLI app project connected to the same app you
   created in the Dev Dashboard (Client ID/Secret already given to me for
   the backend env vars). If you don't have one yet:
   ```
   npm init @shopify/app@latest
   ```
   and when prompted, connect it to the existing "Zavo" app rather than
   creating a new one (`shopify app config link`).
2. Copy this `extensions/ragby-chat-widget/` folder into that project's
   `extensions/` directory.
3. Run `shopify app dev` to test it against your development store, or
   `shopify app deploy` to publish a version once you're happy with it.
4. In the merchant's Shopify admin: **Online Store → Themes → Customize →
   App Embeds** → toggle "Ragby Chat Widget" on, and fill in the **Ragby
   Project ID** setting (found in your Ragby dashboard's URL, or add a copy
   button there later) — this is what tells the widget which project's data
   to load, exactly like `data-project` does for the generic widget.

## What's different from the generic widget (`backend/static/widget.js`)

- Sends `channel: "shopify"` on every `/public/chat` call, instead of no
  channel at all (which defaults to `"public"`) — this is what makes the
  bot's checkout tool (`get_shopify_checkout_link`) available for this
  conversation, and keeps it entirely separate from the generic widget's
  and shareable-link's tool set.
- Adds a `visibilitychange` listener: when the shopper comes back to this
  tab (after being sent to Shopify's real checkout in a new tab), it polls
  `GET /public/shopify/cart-status/{chat_id}` and shows a confirmation
  message if the order went through — this is necessarily asynchronous
  since checkout completion arrives via a Shopify webhook, not something
  this tab can know about directly.
- Otherwise structurally identical to the generic widget (same overlay/
  lead-capture pattern, same session-persistence fix, same URL
  auto-linkification so a relayed checkout link is actually tappable).
