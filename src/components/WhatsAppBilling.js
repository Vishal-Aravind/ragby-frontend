'use client'
// Can this project's WhatsApp account deliver template messages? Without a
// payment method in Meta they fail (code 131042) while normal replies keep
// working, so merchants never noticed. Shown wherever templates are sent.
import { useEffect, useState } from 'react'

export function useWhatsAppBilling(projectId) {
  const [status, setStatus] = useState(null)   // 'ok' | 'missing' | 'unknown' | 'not_connected' | null
  useEffect(() => {
    if (!projectId) return
    let alive = true
    fetch(`/api/whatsapp/billing-status/${projectId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setStatus(d?.status || 'unknown') })
      .catch(() => { if (alive) setStatus('unknown') })
    return () => { alive = false }
  }, [projectId])
  return status
}

const HOW = 'business.facebook.com → your business portfolio → Settings → Billing & payments → add a payment method for your WhatsApp account.'

/** Red when payment is missing; small green line when it's set up; nothing otherwise. */
export function WhatsAppBillingNotice({ status, compact = false }) {
  if (status === 'missing') {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 text-red-900 ${compact ? 'text-[11px] px-2.5 py-2' : 'text-sm px-4 py-3'}`}>
        <p className="font-semibold">WhatsApp can't send these messages - no payment method in Meta.</p>
        <p className="mt-0.5">Template messages (confirmations, reminders, campaigns) are paid by WhatsApp and won't be delivered until you add one: {HOW}</p>
      </div>
    )
  }
  if (status === 'ok') {
    return <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-green-700`}>✓ WhatsApp billing is set up - template messages can be delivered.</p>
  }
  return null
}
