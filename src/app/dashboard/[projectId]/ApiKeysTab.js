'use client'
import { useEffect, useState } from 'react'
import { Copy, RefreshCw, Eye, EyeOff, Check } from 'lucide-react'

export default function ApiKeysTab({ project }) {
  const projectId = project?.id || project
  const [apiKey, setApiKey]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [visible, setVisible]   = useState(false)
  const [copied, setCopied]     = useState(false)
  const [regen, setRegen]       = useState(false)

  const fetchKey = async () => {
    setLoading(true)
    const res = await fetch(`/api/api-keys/${projectId}`)
    if (res.ok) setApiKey(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchKey() }, [projectId])

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const regenerate = async () => {
    if (!confirm("Regenerate API key? Your old key will stop working immediately.")) return
    setRegen(true)
    const res = await fetch(`/api/api-keys/${projectId}/regenerate`, { method: "POST" })
    if (res.ok) await fetchKey()
    setRegen(false)
  }

  const maskedKey = apiKey?.key
    ? `${apiKey.key.slice(0, 8)}${"•".repeat(20)}${apiKey.key.slice(-4)}`
    : ""

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>

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
          <div className="flex gap-2">
            <button onClick={() => setVisible(v => !v)}
              className="text-xs border rounded px-2 py-1 hover:bg-muted flex items-center gap-1">
              {visible ? <EyeOff size={12} /> : <Eye size={12} />}
              {visible ? "Hide" : "Show"}
            </button>
            <button onClick={regenerate} disabled={regen}
              className="text-xs border rounded px-2 py-1 hover:bg-muted flex items-center gap-1 text-red-600 border-red-200">
              <RefreshCw size={12} className={regen ? "animate-spin" : ""} />
              Regenerate
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3">
          <code className="flex-1 text-sm font-mono text-gray-700 break-all">
            {visible ? apiKey?.key : maskedKey}
          </code>
          <button onClick={copyKey}
            className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors">
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          </button>
        </div>

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
  X-API-Key: ${visible ? apiKey?.key : maskedKey}
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
      "X-API-Key": "${visible ? apiKey?.key : "your_api_key"}",
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
    headers={"X-API-Key": "${visible ? apiKey?.key : "your_api_key"}"},
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
  X-API-Key: ${visible ? apiKey?.key : maskedKey}`}
          </pre>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Send to one recipient</p>
          <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto">
{`POST https://ragby-backend.onrender.com/api/send-template
Headers:
  X-API-Key: ${visible ? apiKey?.key : maskedKey}
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
  X-API-Key: ${visible ? apiKey?.key : maskedKey}
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