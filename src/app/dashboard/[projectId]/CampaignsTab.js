'use client'
import { useEffect, useState } from 'react'
import { Plus, Send, CheckCircle, XCircle, Clock, Sparkles, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ragby-backend.onrender.com'

// `onOpenTemplateLibrary` — Template Library now lives in its own top-level
// tab (shared by Campaigns, the public API, and appointment reminders),
// so this just asks the dashboard shell to switch tabs instead of
// rendering it inline here.
export default function CampaignsTab({ project, onOpenTemplateLibrary }) {
  const projectId = project?.id || project
  const [campaigns, setCampaigns]     = useState([])
  const [templates, setTemplates]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [showCreate, setShowCreate]   = useState(false)
  const [sending, setSending]         = useState(false)
  const [syncing, setSyncing]         = useState(false)
  const [error, setError]             = useState(null)

  // Form state
  const [name, setName]               = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [variables, setVariables]     = useState([])
  const [recipientFilter, setRecipientFilter] = useState('whatsapp')
  const [tagFilter, setTagFilter]     = useState('')
  const [availableTags, setAvailableTags] = useState([])
  const [csvContacts, setCsvContacts] = useState([])
  const [sendTiming, setSendTiming]   = useState('now') // now | later
  const [scheduledAt, setScheduledAt] = useState('')
  const [cancellingId, setCancellingId] = useState(null)

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    if (isExcel) {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
      parseRows(rows)
    } else {
      const text = await file.text()
      const rows = text.split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
      parseRows(rows)
    }
  }

  const parseRows = (rows) => {
    if (rows.length < 2) return
    const headers = rows[0].map(h => h.toLowerCase().trim())
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('number'))
    const nameIdx  = headers.findIndex(h => h.includes('name'))
    if (phoneIdx === -1) { setError('No phone column found.'); return }
    const contacts = rows.slice(1)
      .map(row => ({
        phone: String(row[phoneIdx] || '').trim().replace(/\s|-/g, ''),
        name:  nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '',
      }))
      .filter(c => c.phone && c.phone.length >= 7)
    setCsvContacts(contacts)
    setError(null)
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [campRes, tmplRes] = await Promise.all([
        fetch(`/api/campaigns?projectId=${projectId}`),
        fetch(`/api/campaigns/templates?projectId=${projectId}`),
      ])
      if (campRes.ok) {
        const campData = await campRes.json()
        setCampaigns(Array.isArray(campData) ? campData : [])
      }
      if (tmplRes.ok) {
        const tmplData = await tmplRes.json()
        setTemplates(Array.isArray(tmplData) ? tmplData : [])
      }
    } catch (err) {
      console.error('CampaignsTab fetch error:', err)
    }
    setLoading(false)
  }

  // Sync templates from Meta — fetches live approval status
  const syncTemplates = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`/api/template-library/sync/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        // Filter only APPROVED templates for campaign use
        const approved = (data.templates || []).filter(t => t.status === 'APPROVED')
        setTemplates(approved)
      } else {
        setError('Failed to sync templates from Meta')
      }
    } catch (e) {
      setError('Sync failed')
    }
    setSyncing(false)
  }

  useEffect(() => { fetchData() }, [projectId])

  // Pull the set of tags that actually exist on leads, so "By tag" picks
  // from real values instead of asking the user to type one blind.
  useEffect(() => {
    if (!projectId) return
    fetch(`/api/leads?projectId=${projectId}`)
      .then(r => r.ok ? r.json() : [])
      .then(leads => {
        const tags = Array.from(new Set((Array.isArray(leads) ? leads : []).flatMap(l => l.tags || []))).sort()
        setAvailableTags(tags)
      })
      .catch(() => {})
  }, [projectId])

  const selectTemplate = (t) => {
    setSelectedTemplate(t)
    const body = t.components?.find(c => c.type === "BODY")
    const text = body?.text || ""
    const count = (text.match(/\{\{\d+\}\}/g) || []).length
    setVariables(Array(count).fill(""))
  }

  const handleSend = async () => {
    if (!name.trim()) return setError("Campaign name is required")
    if (!selectedTemplate) return setError("Select a template")
    if (recipientFilter === 'csv' && csvContacts.length === 0) return setError("Upload a CSV file first")
    if (recipientFilter === 'tag' && !tagFilter) return setError("Pick a tag first")
    if (sendTiming === 'later') {
      if (!scheduledAt) return setError("Pick a date and time first")
      if (new Date(scheduledAt) <= new Date()) return setError("Scheduled time must be in the future")
    }
    setSending(true)
    setError(null)
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        name,
        template_name: selectedTemplate.name,
        template_language: selectedTemplate.language || 'en_US',
        variables,
        recipient_filter: recipientFilter,
        tag_filter: tagFilter || null,
        csv_contacts: recipientFilter === 'csv' ? csvContacts : null,
        // datetime-local has no timezone info — treat it as local time and
        // convert to a proper ISO string with offset for the backend.
        scheduled_at: sendTiming === 'later' ? new Date(scheduledAt).toISOString() : null,
      })
    })
    if (res.ok) {
      setShowCreate(false)
      setName('')
      setSelectedTemplate(null)
      setVariables([])
      setCsvContacts([])
      setRecipientFilter('whatsapp')
      setTagFilter('')
      setSendTiming('now')
      setScheduledAt('')
      setTimeout(fetchData, 2000)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to send campaign')
    }
    setSending(false)
  }

  const handleCancel = async (campaignId) => {
    if (!confirm('Cancel this scheduled campaign? It will not be sent.')) return
    setCancellingId(campaignId)
    try {
      await fetch(`/api/campaigns/${campaignId}/cancel`, { method: 'POST' })
      await fetchData()
    } finally {
      setCancellingId(null)
    }
  }

  const statusBadge = (status) => {
    const map = {
      draft:     { color: 'bg-gray-100 text-gray-600',   icon: <Clock size={11} />,        label: 'Draft' },
      scheduled: { color: 'bg-indigo-100 text-indigo-700', icon: <Clock size={11} />,      label: 'Scheduled' },
      sending:   { color: 'bg-blue-100 text-blue-600',   icon: <Send size={11} />,         label: 'Sending...' },
      sent:      { color: 'bg-green-100 text-green-700', icon: <CheckCircle size={11} />,  label: 'Sent' },
      cancelled: { color: 'bg-gray-100 text-gray-500',   icon: <XCircle size={11} />,      label: 'Cancelled' },
      failed:    { color: 'bg-red-100 text-red-600',     icon: <XCircle size={11} />,      label: 'Failed' },
    }
    const s = map[status] || map.draft
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
        {s.icon} {s.label}
      </span>
    )
  }

  const templateStatusBadge = (status) => {
    const map = {
      APPROVED: 'bg-green-100 text-green-700',
      PENDING:  'bg-yellow-100 text-yellow-700',
      REJECTED: 'bg-red-100 text-red-600',
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    )
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading campaigns...</div>

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">Send WhatsApp template messages to your contacts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onOpenTemplateLibrary}
            className="flex items-center gap-1.5 border text-sm px-4 py-2 rounded-lg hover:bg-muted">
            <Sparkles size={14} className="text-yellow-500" /> Template Library
          </button>
          <button onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
            <Plus size={14} /> New Campaign
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border rounded-xl p-5 space-y-4 bg-blue-50/30">
          <h3 className="font-medium text-sm">Create Campaign</h3>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Campaign name</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="e.g. Diwali Offer 2026"
              value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* Template selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">Select template</label>
              <button onClick={syncTemplates} disabled={syncing}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50">
                <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing...' : 'Sync from Meta'}
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="border rounded-lg p-4 text-sm text-muted-foreground text-center space-y-2">
                <p>No approved templates found.</p>
                <p className="text-xs">Add templates via <button onClick={onOpenTemplateLibrary} className="text-blue-600 underline">Template Library</button> or click <strong>Sync from Meta</strong> if you already have approved templates.</p>
              </div>
            ) : (
              <div className="mt-1 space-y-2 max-h-48 overflow-y-auto">
                {templates.map(t => {
                  const body = t.components?.find(c => c.type === "BODY")
                  return (
                    <div key={t.name}
                      onClick={() => selectTemplate(t)}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedTemplate?.name === t.name
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:bg-muted/50'
                      }`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{t.name}</p>
                        {templateStatusBadge(t.status)}
                      </div>
                      {body && <p className="text-xs text-muted-foreground mt-1 truncate">{body.text}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Variables */}
          {selectedTemplate && variables.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template variables</label>
              <div className="mt-1 space-y-2">
                {variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{`{{${i + 1}}}`}</span>
                    <input
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder={`Value for {{${i + 1}}}`}
                      value={v}
                      onChange={e => {
                        const newVars = [...variables]
                        newVars[i] = e.target.value
                        setVariables(newVars)
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recipients */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Send to</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[
                { value: 'all', label: 'All contacts' },
                { value: 'whatsapp', label: 'WhatsApp only' },
                { value: 'web', label: 'Web leads only' },
                { value: 'tag', label: '🏷️ By tag' },
                { value: 'csv', label: '📂 Upload CSV/Excel' },
              ].map(opt => (
                <button key={opt.value}
                  onClick={() => setRecipientFilter(opt.value)}
                  className={`text-xs border rounded-lg px-3 py-2 transition-colors ${
                    recipientFilter === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'hover:bg-muted/50'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>

            {recipientFilter === 'tag' && (
              <div className="mt-3 space-y-2">
                {availableTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No tags exist yet — add tags to leads in the Leads tab first.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map(tag => (
                      <button key={tag} type="button" onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          tagFilter === tag ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-muted'
                        }`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {recipientFilter === 'csv' && (
              <div className="mt-3 space-y-2">
                <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/30"
                  onClick={() => document.getElementById('csv-upload').click()}>
                  <input id="csv-upload" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCsvUpload} />
                  {csvContacts.length > 0 ? (
                    <p className="text-sm text-green-700 font-medium">✅ {csvContacts.length} contacts loaded</p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">Click to upload CSV or Excel file</p>
                      <p className="text-xs text-muted-foreground mt-1">Required column: phone — Optional: name</p>
                    </>
                  )}
                </div>
                {csvContacts.length > 0 && (
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 max-h-24 overflow-y-auto">
                    {csvContacts.slice(0, 5).map((c, i) => (
                      <p key={i}>{c.phone} {c.name ? `— ${c.name}` : ''}</p>
                    ))}
                    {csvContacts.length > 5 && <p>...and {csvContacts.length - 5} more</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* When to send */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">When</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[
                { value: 'now', label: 'Send now' },
                { value: 'later', label: '🕒 Schedule for later' },
              ].map(opt => (
                <button key={opt.value}
                  onClick={() => setSendTiming(opt.value)}
                  className={`text-xs border rounded-lg px-3 py-2 transition-colors ${
                    sendTiming === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'hover:bg-muted/50'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {sendTiming === 'later' && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowCreate(false)}
              className="flex-1 border rounded-lg px-4 py-2 text-sm hover:bg-muted">
              Cancel
            </button>
            <button onClick={handleSend} disabled={sending}
              className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {sending
                ? (sendTiming === 'later' ? 'Scheduling...' : 'Sending...')
                : sendTiming === 'later' ? <><Clock size={13} /> Schedule Campaign</> : <><Send size={13} /> Send Campaign</>}
            </button>
          </div>
        </div>
      )}

      {/* Campaigns list */}
      {campaigns.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground border rounded-xl">
          No campaigns yet. Create your first campaign to reach your contacts.
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Template</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Sent</th>
                <th className="text-left px-4 py-3 font-medium">Failed</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.template_name}</td>
                  <td className="px-4 py-3">{statusBadge(c.status)}</td>
                  <td className="px-4 py-3">
                    <span className="text-green-700 font-medium">{c.sent_count}</span>
                    <span className="text-muted-foreground">/{c.total_count}</span>
                  </td>
                  <td className="px-4 py-3 text-red-600">{c.failed_count}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {c.status === 'scheduled' && c.scheduled_at
                      ? <>Scheduled: {new Date(c.scheduled_at).toLocaleString()}</>
                      : new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {c.status === 'scheduled' && (
                      <button onClick={() => handleCancel(c.id)} disabled={cancellingId === c.id}
                        className="text-xs text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50 disabled:opacity-50">
                        {cancellingId === c.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}