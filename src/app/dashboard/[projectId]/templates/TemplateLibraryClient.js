'use client'
import { useState } from 'react'
import { Plus, Check, Clock, Sparkles } from 'lucide-react'

const INDUSTRIES = ['All', 'All businesses', 'Healthcare / Services', 'E-commerce / Retail', 'E-commerce / Delivery', 'Hotels / Travel / Services', 'B2B / Services', 'Retail / Pharmacy']

export default function TemplateLibraryClient({ projectId, initialTemplates }) {
  const [templates, setTemplates]   = useState(initialTemplates || [])
  const [filter, setFilter]         = useState('All')
  const [adding, setAdding]         = useState({})
  const [added, setAdded]           = useState({})
  const [errors, setErrors]         = useState({})

  const addTemplate = async (template) => {
    setAdding(a => ({ ...a, [template.id]: true }))
    setErrors(e => ({ ...e, [template.id]: null }))

    const res = await fetch('/api/template-library/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, template_id: template.id })
    })

    const data = await res.json()

    if (res.ok || data.status === 'exists') {
      setAdded(a => ({ ...a, [template.id]: true }))
    } else {
      setErrors(e => ({ ...e, [template.id]: data.error || 'Failed to add' }))
    }
    setAdding(a => ({ ...a, [template.id]: false }))
  }

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
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">How it works</p>
        <p>Click "Add to my account" on any template → it gets submitted to your WhatsApp Business Account → approved within minutes to hours → ready to use in campaigns.</p>
      </div>

      {/* Industry filter */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'All businesses', 'Healthcare / Services', 'E-commerce / Retail', 'Hotels / Travel / Services', 'B2B / Services'].map(f => (
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
        {filtered.map(t => (
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

            {/* Add button */}
            <button
              onClick={() => addTemplate(t)}
              disabled={adding[t.id] || added[t.id]}
              className={`w-full text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                added[t.id]
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50'
              }`}
            >
              {added[t.id] ? (
                <><Check size={13} /> Added — Pending approval</>
              ) : adding[t.id] ? (
                <><Clock size={13} /> Adding...</>
              ) : (
                <><Plus size={13} /> Add to my account</>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}