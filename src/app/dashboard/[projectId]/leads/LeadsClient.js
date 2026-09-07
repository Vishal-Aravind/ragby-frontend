'use client'
import { useState } from 'react'
import { MessageSquare, Globe, Search, Download, RefreshCw, Tag, Loader2, X } from 'lucide-react'

const PAGE_SIZE = 200

export default function LeadsClient({ projectId, initialLeads, initialTotal, initialError }) {
  const [leads, setLeads]       = useState(initialLeads || [])
  const [total, setTotal]       = useState(initialTotal || 0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(initialError || null)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all') // all | whatsapp | web
  const [tagFilter, setTagFilter] = useState('') // '' = no tag filter

  const [editingTagsFor, setEditingTagsFor] = useState(null) // lead id
  const [newTagText, setNewTagText] = useState('')

  // ── Bulk selection / bulk tagging ────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkTagText, setBulkTagText] = useState('')
  const [bulkApplying, setBulkApplying] = useState(false)

  // Was `r.ok ? r.json() : []`, which turned a 403 into an empty list — so a
  // permission failure rendered as "No leads yet" and the error state below
  // was unreachable.
  const loadPage = async (offset) => {
    const res = await fetch(`/api/leads?projectId=${projectId}&offset=${offset}&limit=${PAGE_SIZE}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Could not load leads.')
    }
    return res.json()
  }

  const fetchLeads = async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const data = await loadPage(0)
      setLeads(data.leads || [])
      setTotal(data.total || 0)
    } catch (e) {
      setError(e.message || 'Could not load leads.')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const data = await loadPage(leads.length)
      // Guard against a lead arriving on page 1 while page 2 is in flight,
      // which shifts the offset window and would otherwise duplicate a row.
      setLeads(prev => {
        const seen = new Set(prev.map(l => l.id))
        return [...prev, ...(data.leads || []).filter(l => !seen.has(l.id))]
      })
      setTotal(data.total || 0)
    } catch (e) {
      setError(e.message || 'Could not load more leads.')
    } finally {
      setLoadingMore(false)
    }
  }

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

  const addTag = (lead, tagValue) => {
    // Lowercase client-side too — matches what the backend normalizes to,
    // so there's no flash of "VIP" before it settles into "vip".
    const tag = (tagValue ?? newTagText).trim().toLowerCase()
    if (!tag) { setEditingTagsFor(null); return }
    const tags = Array.from(new Set([...(lead.tags || []), tag]))
    updateLeadTags(lead, tags)
    setNewTagText('')
    setEditingTagsFor(null)
  }

  const removeTag = (lead, tag) => {
    updateLeadTags(lead, (lead.tags || []).filter(t => t !== tag))
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = (ids) => {
    setSelectedIds(prev => {
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id))
      return allSelected ? new Set() : new Set(ids)
    })
  }

  const applyBulkTag = async () => {
    const tag = bulkTagText.trim().toLowerCase()
    if (!tag || selectedIds.size === 0) return
    setBulkApplying(true)
    try {
      const targets = leads.filter(l => selectedIds.has(l.id))
      await Promise.all(targets.map(l => {
        const tags = Array.from(new Set([...(l.tags || []), tag]))
        return fetch(`/api/leads/${l.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags }),
        })
      }))
      setBulkTagText('')
      setSelectedIds(new Set())
      await fetchLeads()
    } finally {
      setBulkApplying(false)
    }
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

  // Lead names, emails and phones can be written by anyone who can reach the
  // public widget, so this export is attacker-influenced input landing in a
  // spreadsheet. Two separate problems were live here:
  //   1. Fields were wrapped in quotes but never had their own quotes
  //      doubled, so a name containing " broke the row structure and shifted
  //      every column after it.
  //   2. A value starting = + - @ (or a leading tab/CR, which Excel strips
  //      before parsing) is read as a FORMULA, not text — the classic CSV
  //      injection path from "someone filled in your web form" to "code ran
  //      on your machine when you opened the file".
  const csvCell = (value) => {
    let s = value == null ? '' : String(value)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return `"${s.replace(/"/g, '""')}"`
  }

  const exportCSV = () => {
    const rows = [
      ['Name', 'Email', 'Phone', 'Source', 'Tags', 'Date'],
      ...filtered.map(l => [
        l.name || '',
        l.email || '',
        l.phone || '',
        l.channel || l.source || '',
        (l.tags || []).join('; '),
        l.created_at ? new Date(l.created_at).toLocaleDateString() : '',
      ]),
    ]
    // CRLF and a UTF-8 BOM so Excel parses the rows and renders non-ASCII
    // names correctly instead of mojibake.
    const csv = '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading leads...</div>
  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Leads & Contacts</h2>
          <p className="text-sm text-muted-foreground">
            {total} total
            {leads.length < total && ` · ${leads.length} loaded`}
          </p>
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
          <p className="text-2xl font-bold">{total}</p>
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

      {/* Bulk tag bar — shows once at least one lead is selected */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          <span className="text-xs font-medium text-indigo-700 whitespace-nowrap">
            {selectedIds.size} selected
          </span>
          <input
            className="flex-1 border rounded px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Tag to apply to all selected..."
            value={bulkTagText}
            onChange={e => setBulkTagText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyBulkTag()}
          />
          <button
            onClick={applyBulkTag}
            disabled={!bulkTagText.trim() || bulkApplying}
            className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
          >
            {bulkApplying ? <Loader2 size={12} className="animate-spin" /> : <Tag size={12} />}
            Apply tag
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-indigo-400 hover:text-indigo-700 flex items-center gap-1 whitespace-nowrap"
          >
            <X size={12} /> Clear
          </button>
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
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every(l => selectedIds.has(l.id))}
                    onChange={() => toggleSelectAll(filtered.map(l => l.id))}
                  />
                </th>
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
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} />
                    </td>
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
                      <div className="flex flex-col gap-1">
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
                              className="text-xs border rounded px-1.5 py-0.5 w-24 outline-none focus:ring-1 focus:ring-indigo-300"
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
                        {/* Autocomplete suggestions — existing tags matching what's typed,
                            shown inline (not a floating dropdown) so the table's overflow
                            clipping can't cut it off. */}
                        {editingTagsFor === lead.id && newTagText.trim() && (() => {
                          const q = newTagText.trim().toLowerCase()
                          const suggestions = allTags
                            .filter(t => t.includes(q) && !(lead.tags || []).includes(t))
                            .slice(0, 5)
                          return suggestions.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {suggestions.map(t => (
                                <button
                                  key={t}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()} // keep input focused so blur doesn't fire before this click
                                  onClick={() => addTag(lead, t)}
                                  className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          ) : null
                        })()}
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

      {/* Leads are paged now — the endpoint used to return every row of every
          column in one unbounded response, rendered as one <tr> each. Search
          and the filters above only apply to what's loaded, so say so rather
          than letting an empty result look conclusive. */}
      {leads.length < total && (
        <div className="text-center space-y-2 pt-1">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-sm border rounded px-4 py-1.5 hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {loadingMore && <Loader2 size={13} className="animate-spin" />}
            Load {Math.min(PAGE_SIZE, total - leads.length)} more
          </button>
          <p className="text-xs text-muted-foreground">
            Showing {leads.length} of {total}. Search, filters and CSV export
            cover the loaded rows only.
          </p>
        </div>
      )}
    </div>
  )
}
