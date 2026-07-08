'use client'
import { useEffect, useRef, useState } from 'react'
import { Calendar, MapPin, Users, Plus, Trash2, Eye, X, Loader2, Copy, Layout } from 'lucide-react'
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

  // Create form now only asks for the event name — everything else
  // (description, banner, date, location, capacity, contact phone, colors)
  // is filled in on the "Details" tab inside the page design screen right after.
  const [title, setTitle] = useState('')

  // Holds the in-flight "create event" request so savePage can wait on it
  // if the user hits Save before the real event ID has come back yet.
  const pendingCreateRef = useRef(null)

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/events?projectId=${projectId}`)
      if (res.ok) setEvents(await res.json())
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchEvents() }, [projectId])

  const handleCreate = () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    setShowCreate(false)
    setTitle('')

    // Open the builder — and its template picker — instantly. Don't make
    // the user stare at a spinner waiting on the network round-trip;
    // the event row gets created in the background instead.
    setBuilderEvent({ id: null, title: trimmedTitle, page_json: null, form_schema: null, accent_color: '#6366f1' })

    const createPromise = fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, title: trimmedTitle }),
    }).then(res => (res.ok ? res.json() : Promise.reject(new Error('Failed to create event'))))

    pendingCreateRef.current = createPromise

    createPromise
      .then(createdEvent => {
        // Fill in the real ID once it arrives — only if the user is still
        // on this same (not-yet-saved) draft.
        setBuilderEvent(prev => (prev && !prev.id ? { ...prev, ...createdEvent } : prev))
        fetchEvents()
      })
      .catch(e => {
        console.error(e)
        alert('Failed to create the event. Please try again.')
        setBuilderEvent(null)
      })
      .finally(() => { pendingCreateRef.current = null })
  }

  // PageBuilder's onSave now sends blocks/form fields AND the event detail
  // fields (title, description, banner, date, location, etc.) all together,
  // since those are edited in the Details tab of the same screen.
  const savePage = async (data) => {
    // If the user hit Save super fast, the background "create event"
    // request might not have returned an ID yet — wait for it here.
    let eventId = builderEvent.id
    if (!eventId && pendingCreateRef.current) {
      const created = await pendingCreateRef.current
      eventId = created.id
    }
    await fetch(`/api/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
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

      {/* Create form modal — name only; everything else is filled in on the
          Details tab of the page design screen that opens right after. */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Name your event</h3>
              <button onClick={() => { setShowCreate(false); setTitle(''); }}><X size={18} /></button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Event title *</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. Chennai Business Expo 2026"
                value={title} onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus />
              <p className="text-xs text-muted-foreground">
                You'll add the description, banner, date, and other details next, on the same screen where you design the page.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => { setShowCreate(false); setTitle(''); }}
                className="flex-1 border rounded-lg px-4 py-2 text-sm hover:bg-muted">Cancel</button>
              <button onClick={handleCreate} disabled={!title.trim()}
                className="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50">
                Continue
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
                    <Layout size={11} />
                    {Array.isArray(event.page_json) && event.page_json.length > 0 ? "Edit Page" : "Design Page"}
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