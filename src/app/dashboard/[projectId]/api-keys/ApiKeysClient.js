'use client'
import { useState } from 'react'
import { Copy, RefreshCw, Check } from 'lucide-react'

export default function ApiKeysClient({ projectId, initialApiKey, initialError }) {
  const [apiKey, setApiKey]         = useState(initialApiKey || null)
  // Only ever set right after a fresh create/regenerate — the key is
  // hashed at rest and shown exactly once. A normal page load never gets
  // the raw value back, only { has_key: true }.
  const [revealedKey, setRevealedKey] = useState(initialApiKey?.key || null)
  const [copied, setCopied]         = useState(false)
  const [regen, setRegen]           = useState(false)
  const [error, setError]           = useState(initialError || null)

  // The backend no longer mints a key as a side effect of reading one — a
  // GET that creates a live WhatsApp credential was both a read verb doing
  // a write and a way for an agent locked out of this tab to obtain one.
  // Creation happens here, explicitly, through the same regenerate call.
  const hasKey = Boolean(apiKey?.has_key)

  const copyKey = () => {
    navigator.clipboard.writeText(revealedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const mintKey = async (isRotation) => {
    if (isRotation && !confirm("Regenerate API key? Your old key will stop working immediately.")) return
    setRegen(true)
    setError(null)
    try {
      const res = await fetch(`/api/api-keys/${projectId}/regenerate`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.detail || data.error || "Could not create the key.")
        return
      }
      setRevealedKey(data.key)
      setApiKey(a => ({ ...(a || {}), has_key: true }))
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setRegen(false)
    }
  }

  const regenerate = () => mintKey(true)

  // Once revealed this session, show the real value; otherwise a
  // placeholder — there's nothing to mask-and-reveal anymore since the
  // plaintext genuinely isn't stored after the reveal moment passes.
  const displayKey = revealedKey || "•".repeat(32)
  const snippetKey = revealedKey || "your_api_key"

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">API Access</h2>
        <p className="text-sm text-muted-foreground">Use your API key to send WhatsApp messages from any external system</p>
      </div>

      {/* API Key card */}
      <div className="border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Your API Key</p>
          {/* Only meaningful once a key exists — otherwise the panel below
              offers Generate instead. */}
          {(hasKey || revealedKey) && (
            <button onClick={regenerate} disabled={regen}
              className="text-xs border rounded px-2 py-1 hover:bg-muted flex items-center gap-1 text-red-600 border-red-200">
              <RefreshCw size={12} className={regen ? "animate-spin" : ""} />
              Regenerate
            </button>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {revealedKey ? (
          <>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3">
              <code className="flex-1 text-sm font-mono text-gray-700 break-all">{displayKey}</code>
              <button onClick={copyKey}
                className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors">
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Copy this now — for your security we only show it once. If you lose it, you'll need to regenerate.
            </p>
          </>
        ) : (
          <div className="bg-muted/50 rounded-lg px-4 py-3">
            {hasKey ? (
              <>
                <code className="text-sm font-mono text-gray-400">{displayKey}</code>
                <p className="text-xs text-muted-foreground mt-2">
                  A key exists but isn&apos;t shown again after creation. Click Regenerate to get a new one (this invalidates the old one immediately).
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700">No API key yet.</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Generate one to send WhatsApp messages from your own systems. It&apos;s shown once.
                </p>
                <button onClick={() => mintKey(false)} disabled={regen}
                  className="text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50">
                  {regen ? "Generating..." : "Generate API key"}
                </button>
              </>
            )}
          </div>
        )}

        {apiKey?.last_used_at && (
          <p className="text-xs text-muted-foreground">
            Last used: {new Date(apiKey.last_used_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* How to use */}
      <div className="border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold">How to use</h3>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ This only works if the customer has messaged you within the last 24 hours (WhatsApp's rule, not ours).
          To message someone anytime — reminders, confirmations, order updates — use the <strong>template API</strong> below instead.
        </p>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Send a plain WhatsApp message (24-hour window only)</p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto">
{`POST https://ragby-backend.onrender.com/public/send
Headers:
  X-API-Key: ${snippetKey}
  Content-Type: application/json

Body:
{
  "to": "+91 9876543210",
  "message": "Hello! Your order is confirmed."
}`}
          </pre>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Example — Node.js</p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto">
{`const res = await fetch(
  "https://ragby-backend.onrender.com/public/send",
  {
    method: "POST",
    headers: {
      "X-API-Key": "${snippetKey}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: "+91 9876543210",
      message: "Your order is confirmed!",
    }),
  }
);`}
          </pre>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Example — Python</p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto">
{`import requests

requests.post(
    "https://ragby-backend.onrender.com/public/send",
    headers={"X-API-Key": "${snippetKey}"},
    json={
        "to": "+91 9876543210",
        "message": "Your order is confirmed!",
    }
)`}
          </pre>
        </div>
      </div>

      {/* Template API — the "anytime" alternative to /public/send */}
      <div className="border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Send a template message (works anytime)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Uses one of your approved WhatsApp templates (see the Templates tab to add one) — not restricted to the 24-hour window.
            Good for appointment reminders, order confirmations, or any message you need to send proactively.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">List your approved templates</p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto">
{`GET https://ragby-backend.onrender.com/api/templates
Headers:
  X-API-Key: ${snippetKey}`}
          </pre>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Send to one recipient</p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto">
{`POST https://ragby-backend.onrender.com/api/send-template
Headers:
  X-API-Key: ${snippetKey}
  Content-Type: application/json

Body:
{
  "to": "919876543210",
  "template": "appointment_reminder",
  "variables": ["John", "25 Dec 2026", "3:00 PM"]
}`}
          </pre>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Send to many recipients at once (max 100)</p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto">
{`POST https://ragby-backend.onrender.com/api/send-template/bulk
Headers:
  X-API-Key: ${snippetKey}
  Content-Type: application/json

Body:
{
  "template": "appointment_reminder",
  "recipients": [
    { "to": "919876543210", "variables": ["John", "25 Dec", "3pm"] },
    { "to": "919812345678", "variables": ["Priya", "26 Dec", "4pm"] }
  ]
}`}
          </pre>
        </div>
      </div>

      {/* Response */}
      <div className="border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold">Response</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="font-medium text-green-700 mb-1">Success (200)</p>
            <code className="text-green-600">{`{"status": "sent", "to": "+91..."}`}</code>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="font-medium text-red-700 mb-1">Error (401)</p>
            <code className="text-red-600">{`{"detail": "Invalid API key"}`}</code>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="font-medium text-red-700 mb-1">Rate limit (429)</p>
            <code className="text-red-600">{`{"detail": "Monthly limit reached"}`}</code>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="font-medium text-yellow-700 mb-1">Bad request (400)</p>
            <code className="text-yellow-600">{`{"detail": "WhatsApp not connected"}`}</code>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        ⚠️ Keep your API key secret. Don't expose it in frontend code or public repositories.
        Messages sent via API count toward your monthly usage limit.
      </p>
    </div>
  )
}