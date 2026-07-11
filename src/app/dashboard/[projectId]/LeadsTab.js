'use client'
import { useEffect, useState } from 'react'
import { MessageSquare, Globe, Search, Download, RefreshCw, Tag } from 'lucide-react'

export default function LeadsTab({ project }) {
  const projectId = project?.id || project
  const [leads, setLeads]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all') // all | whatsapp | web
  const [tagFilter, setTagFilter] = useState('') // '' = no tag filter

  const [editingTagsFor, setEditingTagsFor] = useState(null) // lead id
  const [newTagText, setNewTagText] = useState('')

  const fetchLeads = () => {
    if (!projectId) return
    setLoading(true)
    fetch(`/api/leads?projectId=${projectId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setLeads(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError('Failed to load.'); setLoading(false); })
  }

  useEffect(() => { fetchLeads() }, [projectId])

  const updateLeadTags = async (lead, tags) => {
    // Optimistic update so the badges feel instant.
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, tags } : l))
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
    if (res.ok) {
      const updated = await res.json()
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, tags: updated.tags || [] } : l))
    } else {
      fetchLeads() // revert to server truth if the save failed
    }
  }

  const addTag = (lead) => {
    const tag = newTagText.trim()
    if (!tag) { setEditingTagsFor(null); return }
    const tags = Array.from(new Set([...(lead.tags || []), tag]))
    updateLeadTags(lead, tags)
    setNewTagText('')
    setEditingTagsFor(null)
  }

  const removeTag = (lead, tag) => {
    updateLeadTags(lead, (lead.tags || []).filter(t => t !== tag))
  }

  const allTags = Array.from(new Set(leads.flatMap(l => l.tags || []))).sort()

  const filtered = leads.filter(l => {
    const matchSearch =
      (l.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.phone || '').includes(search) ||
      (l.email || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ||
      (filter === 'whatsapp' && (l.channel === 'whatsapp' || l.source === 'whatsapp')) ||
      (filter === 'web' && (l.channel === 'web' || l.source === 'widget'))
    const matchTag = !tagFilter || (l.tags || []).includes(tagFilter)
    return matchSearch && matchFilter && matchTag
  })

  const whatsappCount = leads.filter(l => l.channel === 'whatsapp' || l.source === 'whatsapp').length
  const webCount = leads.filter(l => l.channel === 'web' || l.source === 'widget').length

  const exportCSV = () => {
    const header = 'Name,Email,Phone,Source,Tags,Date\n'
    const rows = filtered.map(l =>
      `"${l.name || ''}","${l.email || ''}","${l.phone || ''}","${l.channel || l.source || ''}","${(l.tags || []).join('; ')}","${new Date(l.created_at).toLocaleDateString()}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading leads...</div>
  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Leads & Contacts</h2>
          <p className="text-sm text-muted-foreground">{leads.length} total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchLeads} className="text-sm border rounded px-3 py-1.5 hover:bg-muted flex items-center gap-1">
            <RefreshCw size={13} /> Refresh
          </button>
          {filtered.length > 0 && (
            <button onClick={exportCSV} className="text-sm border rounded px-3 py-1.5 hover:bg-muted flex items-center gap-1">
              <Download size={13} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold">{leads.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="border rounded-lg p-3 text-center bg-green-50">
          <p className="text-2xl font-bold text-green-700">{whatsappCount}</p>
          <p className="text-xs text-green-600 flex items-center justify-center gap-1">
            <MessageSquare size={11} /> WhatsApp
          </p>
        </div>
        <div className="border rounded-lg p-3 text-center bg-blue-50">
          <p className="text-2xl font-bold text-blue-700">{webCount}</p>
          <p className="text-xs text-blue-600 flex items-center justify-center gap-1">
            <Globe size={11} /> Web Widget
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full border rounded px-3 py-2 pl-8 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border rounded overflow-hidden text-sm">
          {['all', 'whatsapp', 'web'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'hover:bg-muted'}`}>
              {f === 'all' ? 'All' : f === 'whatsapp' ? '📱 WhatsApp' : '🌐 Web'}
            </button>
          ))}
        </div>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
            <Tag size={11} /> Tag:
          </span>
          <button onClick={() => setTagFilter('')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              !tagFilter ? 'bg-gray-900 text-white border-gray-900' : 'hover:bg-muted'
            }`}>
            All
          </button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                tagFilter === tag ? 'bg-indigo-600 text-white border-indigo-600' : 'hover:bg-muted'
              }`}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {leads.length === 0
            ? 'No leads yet. They appear here when someone messages your WhatsApp or fills the web chat form.'
            : 'No results for your search.'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Source</th>
                <th className="text-left px-4 py-3 font-medium">Tags</th>
                <th className="text-left px-4 py-3 font-medium">Last seen</th>
                <th className="text-left px-4 py-3 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, i) => {
                const isWhatsApp = lead.channel === 'whatsapp' || lead.source === 'whatsapp'
                return (
                  <tr key={lead.id} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                    <td className="px-4 py-3 font-medium">{lead.name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 font-mono text-xs">{lead.phone || '—'}</td>
                    <td className="px-4 py-3">{lead.email || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        isWhatsApp
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {isWhatsApp ? '📱 WhatsApp' : '🌐 Web'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {(lead.tags || []).map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">
                            {tag}
                            <button onClick={() => removeTag(lead, tag)} className="text-indigo-400 hover:text-red-600 leading-none">×</button>
                          </span>
                        ))}
                        {editingTagsFor === lead.id ? (
                          <input
                            autoFocus
                            className="text-xs border rounded px-1.5 py-0.5 w-20 outline-none focus:ring-1 focus:ring-indigo-300"
                            placeholder="tag..."
                            value={newTagText}
                            onChange={e => setNewTagText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') addTag(lead)
                              if (e.key === 'Escape') { setEditingTagsFor(null); setNewTagText('') }
                            }}
                            onBlur={() => addTag(lead)}
                          />
                        ) : (
                          <button
                            onClick={() => { setEditingTagsFor(lead.id); setNewTagText('') }}
                            className="text-xs text-muted-foreground hover:text-indigo-600 border border-dashed rounded-full px-2 py-0.5"
                          >
                            + tag
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {lead.last_seen_at ? new Date(lead.last_seen_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
