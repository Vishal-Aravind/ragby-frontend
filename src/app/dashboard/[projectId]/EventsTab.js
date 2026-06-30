'use client'
import { useEffect, useState } from 'react'
import { Calendar, MapPin, Users, Plus, Trash2, Eye, X, Loader2, Copy, Phone, Layout } from 'lucide-react'
import PageBuilder from '@/components/builder/PageBuilder'

export default function EventsTab({ project }) {
  const projectId = project?.id || project
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [viewingEvent, setViewingEvent] = useState(null)
  const [builderEvent, setBuilderEvent] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [loadingRegs, setLoadingRegs] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    banner_url: '',
    event_date: '',
    event_time: '',
    location: '',
    capacity: '',
    registration_deadline: '',
    contact_phone: '',
    accent_color: '#6366f1',
  })

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events?projectId=${projectId}`)
      if (res.ok) setEvents(await res.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchEvents() }, [projectId])

  const resetForm = () => {
    setForm({
      title: '', description: '', banner_url: '', event_date: '', event_time: '',
      location: '', capacity: '', registration_deadline: '', contact_phone: '',
      accent_color: '#6366f1',
    })
  }

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingBanner(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'flow-media')
      formData.append('folder', 'events')
      const res = await fetch('/api/storage/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const { url } = await res.json()
        setForm(f => ({ ...f, banner_url: url }))
      }
    } catch (e) { console.error(e) }
    setUploadingBanner(false)
  }

  const handleCreate = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const payload = {
        project_id: projectId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        banner_url: form.banner_url || null,
        event_date: form.event_date || null,
        event_time: form.event_time.trim() || null,
        location: form.location.trim() || null,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        registration_deadline: form.registration_deadline || null,
        contact_phone: form.contact_phone.trim() || null,
        accent_color: form.accent_color,
      }
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowCreate(false)
        resetForm()
        fetchEvents()
      }
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const savePage = async ({ page_json, form_schema }) => {
    await fetch(`/api/events/${builderEvent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_json, form_schema }),
    })
    setBuilderEvent(null)
    fetchEvents()
  }

  const toggleActive = async (event) => {
    await fetch(`/api/events/${event.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !event.is_active }),
    })
    fetchEvents()
  }

  const deleteEvent = async (eventId) => {
    if (!confirm('Delete this event? All registrations will also be deleted.')) return
    await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
    fetchEvents()
  }

  const viewRegistrations = async (event) => {
    setViewingEvent(event)
    setLoadingRegs(true)
    try {
      const res = await fetch(`/api/events/${event.id}/registrations`)
      if (res.ok) setRegistrations(await res.json())
    } catch (e) { console.error(e) }
    setLoadingRegs(false)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const registrationUrl = (eventId) =>
    `${typeof window !== 'undefined' ? window.location.origin : ''}/event/${eventId}`

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading events...</div>

  // Registrations detail view
  if (viewingEvent) {
    return (
      <div className="p-6 space-y-4">
        <button onClick={() => setViewingEvent(null)} className="text-sm text-muted-foreground hover:text-gray-800">
          ← Back to Events
        </button>
        <div>
          <h2 className="text-lg font-semibold">{viewingEvent.title}</h2>
          <p className="text-sm text-muted-foreground">{registrations.length} registration{registrations.length !== 1 ? 's' : ''}</p>
        </div>

        {loadingRegs ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : registrations.length === 0 ? (
          <div className="text-center py-12 border rounded-xl text-sm text-muted-foreground">
            No registrations yet. Share the registration link to get started.
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Phone</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Registered</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">+{r.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        r.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-700'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(r.created_at).toLocaleDateString()}
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Events</h2>
          <p className="text-sm text-muted-foreground">Create event registrations — webinars, expos, workshops, demos</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={14} /> New Event
        </button>
      </div>

      {/* Create form modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Create Event</h3>
              <button onClick={() => { setShowCreate(false); resetForm(); }}><X size={18} /></button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Event title *</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. Chennai Business Expo 2026"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200" rows={3}
                placeholder="Brief description shown on registration page"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Banner image</label>
              {form.banner_url ? (
                <div className="relative">
                  <img src={form.banner_url} className="w-full h-32 object-cover rounded-lg border" />
                  <button onClick={() => setForm(f => ({ ...f, banner_url: '' }))}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                </div>
              ) : (
                <label className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/30 block">
                  <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                  <p className="text-sm text-muted-foreground">{uploadingBanner ? 'Uploading...' : 'Click to upload banner image'}</p>
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Time</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="10 AM - 4 PM"
                  value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Location</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Chennai Trade Centre"
                value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Capacity (optional)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Unlimited"
                  value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Accent color</label>
                <input type="color" className="w-full h-9 border rounded-lg cursor-pointer"
                  value={form.accent_color} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Contact phone (for "Call to Attend")</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="+91 98765 43210"
                value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => { setShowCreate(false); resetForm(); }}
                className="flex-1 border rounded-lg px-4 py-2 text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.title.trim()}
                className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events list */}
      {events.length === 0 ? (
        <div className="text-center py-12 border rounded-xl text-sm text-muted-foreground">
          No events yet. Create your first event to start collecting registrations.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map(event => (
            <div key={event.id} className="border rounded-xl overflow-hidden bg-white">
              {event.banner_url && (
                <img src={event.banner_url} className="w-full h-32 object-cover" />
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-sm">{event.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${
                    event.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>{event.is_active ? 'Active' : 'Inactive'}</span>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  {event.event_date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} /> {formatDate(event.event_date)}{event.event_time ? ` • ${event.event_time}` : ''}
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={11} /> {event.location}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Users size={11} /> {event.registration_count} registered{event.capacity ? ` / ${event.capacity}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input readOnly value={registrationUrl(event.id)}
                    className="flex-1 text-xs border rounded px-2 py-1 bg-muted/30 text-muted-foreground truncate" />
                  <button onClick={() => navigator.clipboard.writeText(registrationUrl(event.id))}
                    className="text-xs border rounded px-2 py-1 hover:bg-muted shrink-0">
                    <Copy size={11} />
                  </button>
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={() => setBuilderEvent(event)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-lg px-3 py-1.5">
                    <Layout size={11} /> Edit Page
                  </button>
                  <button onClick={() => viewRegistrations(event)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5">
                    <Eye size={11} /> Registrations
                  </button>
                  <button onClick={() => toggleActive(event)}
                    className="text-xs border rounded-lg px-3 py-1.5 hover:bg-muted">
                    {event.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button onClick={() => deleteEvent(event.id)}
                    className="text-xs border rounded-lg px-2 py-1.5 hover:bg-red-50 text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {builderEvent && (
        <PageBuilder
          event={builderEvent}
          onSave={savePage}
          onClose={() => setBuilderEvent(null)}
        />
      )}
    </div>
  )
}