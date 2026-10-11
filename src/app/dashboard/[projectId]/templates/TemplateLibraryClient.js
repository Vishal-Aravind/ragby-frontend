'use client'
import { useEffect, useState } from 'react'
import { Plus, Check, Clock, Sparkles, XCircle, RefreshCw } from 'lucide-react'

// What WhatsApp says about a template already in the account.
const STATUS = {
  APPROVED:  { label: 'Approved - ready to use', cls: 'bg-green-50 text-green-700 border border-green-200', Icon: Check },
  PENDING:   { label: 'Pending approval',        cls: 'bg-amber-50 text-amber-700 border border-amber-200', Icon: Clock },
  IN_APPEAL: { label: 'In appeal',               cls: 'bg-amber-50 text-amber-700 border border-amber-200', Icon: Clock },
  REJECTED:  { label: 'Rejected by WhatsApp',    cls: 'bg-red-50 text-red-700 border border-red-200',       Icon: XCircle },
  PAUSED:    { label: 'Paused by WhatsApp',      cls: 'bg-red-50 text-red-700 border border-red-200',       Icon: XCircle },
  DISABLED:  { label: 'Disabled by WhatsApp',    cls: 'bg-red-50 text-red-700 border border-red-200',       Icon: XCircle },
}

export default function TemplateLibraryClient({ projectId, initialTemplates, initialError }) {
  const [templates]                 = useState(initialTemplates || [])
  const [filter, setFilter]         = useState('All')
  const [adding, setAdding]         = useState({})
  const [errors, setErrors]         = useState({})
  // template name -> WhatsApp status, for templates already in the account
  const [statuses, setStatuses]     = useState({})
  const [syncing, setSyncing]       = useState(false)
  const [syncNote, setSyncNote]     = useState('')

  const loadStatuses = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`/api/template-library/sync/${projectId}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSyncNote(data.detail === 'WhatsApp not connected'
          ? 'Connect WhatsApp in Integrations to add templates.'
          : "Couldn't check approval status with WhatsApp right now.")
        return
      }
      const map = {}
      for (const t of data.templates || []) {
        if (t.language === 'en_US' || !map[t.name]) map[t.name] = t.status
      }
      setStatuses(map)
      setSyncNote('')
    } catch {
      setSyncNote('')
    } finally {
      setSyncing(false)
    }
  }

  // Show which templates are already in the WhatsApp account (and approved),
  // so a refresh no longer makes every card say "Add to my account" again.
  useEffect(() => { loadStatuses() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId])

  const addTemplate = async (template) => {
    setAdding(a => ({ ...a, [template.id]: true }))
    setErrors(e => ({ ...e, [template.id]: null }))

    const res = await fetch('/api/template-library/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, template_id: template.id })
    })

    const data = await res.json().catch(() => ({}))

    if (res.ok || data.status === 'exists') {
      setStatuses(s => ({ ...s, [template.name]: s[template.name] || 'PENDING' }))
      if (data.status === 'exists') loadStatuses()
    } else {
      // data.error is WhatsApp's own rejection reason (e.g. a formatting
      // issue with the template) — genuinely useful to show, unlike a raw
      // JSON blob, but Meta's phrasing/error codes read as cryptic on
      // their own, so it gets a plain-language lead-in here.
      setErrors(e => ({ ...e, [template.id]: data.error ? `WhatsApp rejected this template: ${data.error}` : 'Failed to add this template.' }))
    }
    setAdding(a => ({ ...a, [template.id]: false }))
  }

  // Every industry that has a template (the fixed list used to miss two).
  const industries = ['All', ...Array.from(new Set(templates.map(t => t.industry).filter(Boolean)))]

  const filtered = filter === 'All'
    ? templates
    : templates.filter(t => t.industry === filter)

  const categoryColor = (cat) => cat === 'MARKETING'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-blue-100 text-blue-700'

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles size={18} className="text-yellow-500" />
              Template Library
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-built templates — add to your WhatsApp account with one click. Used by Campaigns, the API, and appointment reminders.
          </p>
        </div>
        <button onClick={loadStatuses} disabled={syncing}
          className="text-sm border rounded px-3 py-1.5 hover:bg-muted flex items-center gap-1 disabled:opacity-50"
          title="Check approval status with WhatsApp">
          <RefreshCw size={13} className={syncing ? 'animate-spin' : undefined} /> Refresh status
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">How it works</p>
        <p>Click "Add to my account" on any template → it gets submitted to your WhatsApp Business Account → approved within minutes to hours → ready to use in campaigns.</p>
      </div>

      {initialError && <p className="text-sm text-red-600">{initialError}</p>}
      {syncNote && <p className="text-sm text-amber-700">{syncNote}</p>}

      {/* Industry filter */}
      <div className="flex gap-2 flex-wrap">
        {industries.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f ? 'bg-gray-900 text-white border-gray-900' : 'hover:bg-muted/50'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(t => {
          const st = statuses[t.name] ? (STATUS[statuses[t.name]] || { label: statuses[t.name].toLowerCase().replace(/_/g, ' '), cls: 'bg-gray-50 text-gray-600 border', Icon: Clock }) : null
          return (
            <div key={t.id} className="border rounded-xl p-4 space-y-3 hover:border-gray-300 transition-colors">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{t.display_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.industry}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(t.category)}`}>
                  {t.category}
                </span>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 leading-relaxed">{t.preview}</p>
              </div>

              {/* Variables */}
              <div className="flex flex-wrap gap-1">
                {t.variables.map((v, i) => (
                  <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                    {`{{${i+1}}}`} {v}
                  </span>
                ))}
              </div>

              {/* Error */}
              {errors[t.id] && (
                <p className="text-xs text-red-600">{errors[t.id]}</p>
              )}
              {statuses[t.name] === 'REJECTED' && (
                <p className="text-xs text-red-600">WhatsApp rejected it. Delete it in WhatsApp Manager, then add it again.</p>
              )}

              {/* Status, or the add button */}
              {st ? (
                <div className={`w-full text-sm py-2 rounded-lg flex items-center justify-center gap-1.5 ${st.cls}`}>
                  <st.Icon size={13} /> {st.label}
                </div>
              ) : (
                <button
                  onClick={() => addTemplate(t)}
                  disabled={adding[t.id]}
                  className="w-full text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {adding[t.id] ? (
                    <><Clock size={13} /> Adding...</>
                  ) : (
                    <><Plus size={13} /> Add to my account</>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
