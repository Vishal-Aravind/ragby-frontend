'use client'
// A plain reminder wherever template messages are sent: WhatsApp only
// delivers them when the WhatsApp account has a payment method / funds.

export function WhatsAppBillingNote({ compact = false }) {
  return (
    <p className={`rounded-lg border border-amber-200 bg-amber-50 text-amber-900 ${compact ? 'text-[11px] px-2.5 py-2' : 'text-xs px-3 py-2'}`}>
      Make sure a payment method (or funds) is added to your WhatsApp account in Meta - WhatsApp only sends these messages when it is.
      {' '}business.facebook.com → your business portfolio → Settings → Billing &amp; payments.
    </p>
  )
}
