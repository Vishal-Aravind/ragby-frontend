'use client'
import { useEffect, useState } from 'react'
import { Plus, Check, Clock, Sparkles, XCircle, RefreshCw, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/confirmDialog'
import CreateTemplateDialog from './CreateTemplateDialog'
import { TemplatePreview, previewFromMeta, languageName } from './templateShared'
import { useWhatsAppBilling, WhatsAppBillingNotice } from '@/components/WhatsAppBilling'

// What WhatsApp says about a template in the account.
const STATUS = {
  APPROVED:  { label: 'Approved - ready to use', short: 'Approved', cls: 'bg-green-50 text-green-700 border border-green-200', Icon: Check },
  PENDING:   { label: 'Pending approval',        short: 'Pending',  cls: 'bg-amber-50 text-amber-700 border border-amber-200', Icon: Clock },
  IN_APPEAL: { label: 'In appeal',               short: 'In appeal', cls: 'bg-amber-50 text-amber-700 border border-amber-200', Icon: Clock },
  REJECTED:  { label: 'Rejected by WhatsApp',    short: 'Rejected', cls: 'bg-red-50 text-red-700 border border-red-200',       Icon: XCircle },
  PAUSED:    { label: 'Paused by WhatsApp',      short: 'Paused',   cls: 'bg-red-50 text-red-700 border border-red-200',       Icon: XCircle },
  DISABLED:  { label: 'Disabled by WhatsApp',    short: 'Disabled', cls: 'bg-red-50 text-red-700 border border-red-200',       Icon: XCircle },
}
const statusInfo = (s) => STATUS[s] || { label: String(s || '').toLowerCase().replace(/_/g, ' '), short: String(s || '').toLowerCase(), cls: 'bg-gray-50 text-gray-600 border', Icon: Clock }

const categoryColor = (cat) => cat === 'MARKETING' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'

export default function TemplateLibraryClient({ projectId, initialTemplates, initialError }) {
  const [templates]                 = useState(initialTemplates || [])
  const [tab, setTab]               = useState('mine')
  const [filter, setFilter]         = useState('All')
  const [adding, setAdding]         = useState({})
  const [errors, setErrors]         = useState({})
  // Every template in the WhatsApp account (library and custom), as WhatsApp reports them.
  const [account, setAccount]       = useState([])
  const [loaded, setLoaded]         = useState(false)
  const [syncing, setSyncing]       = useState(false)
  const [syncNote, setSyncNote]     = useState('')
  const [creating, setCreating]     = useState(false)
  const [deleting, setDeleting]     = useState({})
  const billing = useWhatsAppBilling(projectId)

  const loadAccount = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`/api/template-library/sync/${projectId}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSyncNote(data.detail === 'WhatsApp not connected'
          ? 'Connect WhatsApp in Integrations to add templates.'
          : "Couldn't check your templates with WhatsApp right now.")
        return
      }
      setAccount(data.templates || [])
      setSyncNote('')
    } catch {
      setSyncNote("Couldn't check your templates with WhatsApp right now.")
    } finally {
      setSyncing(false)
      setLoaded(true)
    }
  }

  useEffect(() => { loadAccount() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId])

  // template name -> status (English preferred), for the library cards.
  const statusByName = {}
  for (const t of account) {
    if (t.language === 'en_US' || !statusByName[t.name]) statusByName[t.name] = t.status
  }

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
      await loadAccount()
      setAccount(prev => prev.some(t => t.name === template.name) ? prev
        : [{ name: template.name, language: template.language, status: 'PENDING', category: template.category, components: template.components }, ...prev])
    } else {
      setErrors(e => ({ ...e, [template.id]: data.error === 'WhatsApp not connected'
        ? 'Connect WhatsApp in Integrations first.'
        : data.error ? `WhatsApp rejected this template: ${data.error}` : 'Failed to add this template.' }))
    }
    setAdding(a => ({ ...a, [template.id]: false }))
  }

  const deleteTemplate = async (t) => {
    const ok = await confirmDialog({
      title: `Delete "${t.name}"?`,
      description: 'It is removed from your WhatsApp account and can no longer be sent. WhatsApp may not let you reuse this exact name for a while, so pick a new name if you recreate it.',
      confirmText: 'Delete',
    })
    if (!ok) return
    const key = `${t.name}|${t.language}`
    setDeleting(d => ({ ...d, [key]: true }))
    try {
      const res = await fetch('/api/templates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name: t.name, id: t.id || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(typeof data.detail === 'string' ? data.detail : "Couldn't delete this template."); return }
      setAccount(prev => prev.filter(x => !(x.name === t.name && (t.id ? x.id === t.id : x.language === t.language))))
      toast.success('Template deleted.')
    } finally {
      setDeleting(d => ({ ...d, [key]: false }))
    }
  }

  const onCreated = ({ name, language, status }) => {
    toast.success('Submitted to WhatsApp for approval.')
    setTab('mine')
    loadAccount().then(() => setAccount(prev => prev.some(t => t.name === name && t.language === language) ? prev
      : [{ name, language, status, category: '', components: [] }, ...prev]))
  }

  // Every industry that has a template.
  const industries = ['All', ...Array.from(new Set(templates.map(t => t.industry).filter(Boolean)))]
  const filtered = filter === 'All' ? templates : templates.filter(t => t.industry === filter)

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-yellow-500" />
            WhatsApp Templates
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Messages WhatsApp has approved in advance - used by Campaigns, the API, and appointment reminders.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAccount} disabled={syncing}
            className="text-sm border rounded px-3 py-1.5 hover:bg-muted flex items-center gap-1 disabled:opacity-50"
            title="Check approval status with WhatsApp">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : undefined} /> Refresh status
          </button>
          <button onClick={() => setCreating(true)}
            className="text-sm rounded px-3 py-1.5 bg-gray-900 text-white hover:bg-gray-800 flex items-center gap-1">
            <Plus size={13} /> Create template
          </button>
        </div>
      </div>

      {initialError && <p className="text-sm text-red-600">{initialError}</p>}
      <WhatsAppBillingNotice status={billing} />
      {syncNote && <p className="text-sm text-amber-700">{syncNote}</p>}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[['mine', `My templates${loaded ? ` (${account.length})` : ''}`], ['library', 'Template library']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`text-sm px-3 py-2 -mb-px border-b-2 ${tab === k ? 'border-gray-900 font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'mine' ? (
        <>
          {!loaded ? (
            <div className="py-10 flex justify-center"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
          ) : account.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-muted-foreground">No templates in your WhatsApp account yet.</p>
              <p className="text-sm text-muted-foreground">
                <button className="underline" onClick={() => setCreating(true)}>Create your own</button> or add a ready-made one from the{' '}
                <button className="underline" onClick={() => setTab('library')}>Template library</button>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {account.map(t => {
                const st = statusInfo(t.status)
                const key = `${t.name}|${t.language}`
                return (
                  <div key={t.id || key} className="border rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm font-mono truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{languageName(t.language)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {t.category && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(t.category)}`}>{t.category}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${st.cls}`}>
                          <st.Icon size={11} /> {st.short}
                        </span>
                      </div>
                    </div>
                    {t.components?.length > 0 && <TemplatePreview {...previewFromMeta(t)} compact />}
                    {t.status === 'REJECTED' && (
                      <p className="text-xs text-red-600">
                        WhatsApp rejected it{t.rejected_reason && t.rejected_reason !== 'NONE' ? ` (${String(t.rejected_reason).toLowerCase().replace(/_/g, ' ')})` : ''}.
                        {' '}Delete it and create a corrected version with a new name.
                      </p>
                    )}
                    <div className="flex justify-end">
                      <button onClick={() => deleteTemplate(t)} disabled={deleting[key]}
                        className="text-xs text-red-600 hover:bg-red-50 rounded px-2 py-1 inline-flex items-center gap-1 disabled:opacity-50">
                        {deleting[key] ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">How it works</p>
            <p>Click "Add to my account" on any template → it gets submitted to your WhatsApp Business Account → approved within minutes to hours → ready to use in campaigns.</p>
          </div>

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(t => {
              const s = statusByName[t.name]
              const st = s ? statusInfo(s) : null
              return (
                <div key={t.id} className="border rounded-xl p-4 space-y-3 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{t.display_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.industry}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(t.category)}`}>
                      {t.category}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600 leading-relaxed">{t.preview}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {t.variables.map((v, i) => (
                      <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{`{{${i + 1}}}`} {v}</span>
                    ))}
                  </div>
                  {errors[t.id] && <p className="text-xs text-red-600">{errors[t.id]}</p>}
                  {s === 'REJECTED' && (
                    <p className="text-xs text-red-600">WhatsApp rejected it. Delete it in My templates and create your own version with a new name.</p>
                  )}
                  {st ? (
                    <div className={`w-full text-sm py-2 rounded-lg flex items-center justify-center gap-1.5 ${st.cls}`}>
                      <st.Icon size={13} /> {st.label}
                    </div>
                  ) : (
                    <button onClick={() => addTemplate(t)} disabled={adding[t.id]}
                      className="w-full text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
                      {adding[t.id] ? <><Clock size={13} /> Adding...</> : <><Plus size={13} /> Add to my account</>}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <CreateTemplateDialog
        open={creating}
        onOpenChange={setCreating}
        projectId={projectId}
        existingNames={account.map(t => `${t.name}|${t.language}`)}
        onCreated={onCreated}
      />
    </div>
  )
}
