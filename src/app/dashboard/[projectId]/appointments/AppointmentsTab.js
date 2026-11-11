'use client'
import { useEffect, useState } from 'react'
import { Clock, Settings, Check, X, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, Search, List, CalendarDays, Plus, Pencil, Trash2 } from 'lucide-react'
import { confirmDialog } from "@/components/confirmDialog";
import { toast } from 'sonner'
import { BookingRules, ServiceOverrides, ServiceOptions, QuestionsEditor, NumberField, RemindersEditor, BookingLinkCard, FollowupCard } from './AvailabilityEditor'
import ManualBooking from './ManualBooking'
import SchedulesCard from './SchedulesCard'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL

// The timezone your working hours and Google Calendar events are in. This
// was hardcoded to Asia/Kolkata in the backend, so a merchant anywhere else
// got calendar events at the wrong time with no way to fix it. Kept to a
// short list of IANA zones rather than all ~600 — these cover the markets
// this product actually serves, and the field accepts any valid zone if one
// is ever set directly.
const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Colombo',
  'Asia/Kathmandu', 'Asia/Singapore', 'Asia/Jakarta', 'Asia/Manila',
  'Asia/Bangkok', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Australia/Sydney',
  'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Madrid', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg',
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Toronto', 'America/Sao_Paulo', 'UTC',
]

function emptyServiceForm() {
  return {
    name: '', description: '', duration_minutes: 30, price: 0, payment_mode: 'free', is_active: true, sort_order: 0,
    slot_capacity: null, slot_interval_minutes: null, buffer_before_minutes: null, buffer_after_minutes: null,
    min_notice_minutes: null, fixed_times_text: '',
    schedule_id: null, booking_window_type: null, booking_window_days: null, booking_window_start: null,
    booking_window_end: null, max_per_day: null, is_hidden: false, questions: [],
    requires_approval: false, location: '', confirmation_note: '', cancel_cutoff_hours: null, duration_options_text: '',
  }
}

const PAYMENT_MODE_LABELS = {
  free: 'Free — no payment',
  hold_to_confirm: 'Pay to confirm — slot held until paid',
  request_after: 'Book now, pay later',
}

export default function AppointmentsTab({ project }) {
  const projectId = project?.id || project
  const [activeTab, setActiveTab] = useState('appointments')
  const [appointments, setAppointments] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [googleConnecting, setGoogleConnecting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('upcoming') // upcoming | completed | cancelled | all
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('agenda') // agenda | calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  // ── Services (Calendly-style event types) ─────────────
  const [services, setServices] = useState([])
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [serviceForm, setServiceForm] = useState(emptyServiceForm())
  const [savingService, setSavingService] = useState(false)
  const [razorpayConnected, setRazorpayConnected] = useState(false)
  const [schedules, setSchedules] = useState([])
  const [showManual, setShowManual] = useState(false)


  const fetchData = async () => {
    setLoading(true)
    try {
      const [apptRes, settingsRes, servicesRes, schedulesRes] = await Promise.all([
        fetch(`/api/appointments?projectId=${projectId}`),
        fetch(`/api/appointment-settings/${projectId}`),
        fetch(`/api/appointment-services?project_id=${projectId}`),
        fetch(`/api/appointment-schedules?project_id=${projectId}`),
      ])
      if (apptRes.ok) setAppointments(await apptRes.json())
      if (settingsRes.ok) {
        // The owner's WhatsApp number is shown as a country code and a number
        const st = await settingsRes.json()
        const code = String(st.owner_phone_code || '91')
        setSettings({ ...st, owner_phone_code: code, owner_phone_number: st.owner_phone ? String(st.owner_phone).slice(String(st.owner_phone_code || '').length) : '' })
      }
      if (servicesRes.ok) setServices(await servicesRes.json())
      if (schedulesRes.ok) setSchedules(await schedulesRes.json())
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [projectId])

  useEffect(() => {
    if (!projectId) return
    fetch(`/api/razorpay/status/${projectId}`)
      .then(r => r.ok ? r.json() : { connected: false })
      .then(data => setRazorpayConnected(!!data.connected))
      .catch(() => setRazorpayConnected(false))
  }, [projectId])

  const openNewServiceForm = () => {
    setEditingService(null)
    setServiceForm(emptyServiceForm())
    setShowServiceForm(true)
  }

  const openEditServiceForm = (svc) => {
    setEditingService(svc)
    setServiceForm({
      name: svc.name || '', description: svc.description || '',
      duration_minutes: svc.duration_minutes || 30,
      price: svc.price || 0, payment_mode: svc.payment_mode || 'free',
      is_active: svc.is_active, sort_order: svc.sort_order || 0,
      slot_capacity: svc.slot_capacity ?? null, slot_interval_minutes: svc.slot_interval_minutes ?? null,
      buffer_before_minutes: svc.buffer_before_minutes ?? null, buffer_after_minutes: svc.buffer_after_minutes ?? null,
      min_notice_minutes: svc.min_notice_minutes ?? null, fixed_times_text: (svc.fixed_times || []).join(', '),
      schedule_id: svc.schedule_id ?? null, booking_window_type: svc.booking_window_type ?? null,
      booking_window_days: svc.booking_window_days ?? null, booking_window_start: svc.booking_window_start ?? null,
      booking_window_end: svc.booking_window_end ?? null, max_per_day: svc.max_per_day ?? null,
      is_hidden: !!svc.is_hidden, questions: svc.questions || [],
      requires_approval: !!svc.requires_approval, location: svc.location || '',
      confirmation_note: svc.confirmation_note || '', cancel_cutoff_hours: svc.cancel_cutoff_hours ?? null,
      duration_options_text: (svc.duration_options || []).join(', '),
    })
    setShowServiceForm(true)
  }

  const saveService = async () => {
    if (!serviceForm.name.trim()) return
    setSavingService(true)
    try {
      const { fixed_times_text, duration_options_text, ...rest } = serviceForm
      const lengths = String(duration_options_text || '').split(/[,\s]+/).filter(Boolean).map(n => parseInt(n)).filter(n => n > 0)
      rest.duration_options = lengths.length ? lengths : null
      rest.questions = (rest.questions || []).filter(q => (q.label || '').trim()).map(({ options_text, ...q }) => q)
      const times = String(fixed_times_text || '').split(/[,\s]+/).filter(Boolean)
      const payload = { ...rest, fixed_times: times.length ? times : null }
      const res = editingService
        ? await fetch(`/api/appointment-services/${editingService.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/appointment-services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: projectId, ...payload }),
          })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.detail === 'string' ? data.detail : data.error || 'Failed to save service')
      }
      setShowServiceForm(false)
      fetchData()
    } catch (e) {
      toast.error(e.message || 'Failed to save service')
    }
    setSavingService(false)
  }

  const toggleServiceActive = async (svc) => {
    await fetch(`/api/appointment-services/${svc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !svc.is_active }),
    })
    fetchData()
  }

  const deleteServiceHandler = async (svc) => {
    if (!(await confirmDialog({ title: `Delete "${svc.name}"?`, description: "This can't be undone.", confirmText: "Delete" }))) return
    const res = await fetch(`/api/appointment-services/${svc.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.detail || data.error || 'This service has existing bookings — deactivate it instead of deleting.')
      return
    }
    fetchData()
  }

  // Listen for Google OAuth popup callback
  useEffect(() => {
    const handler = async (event) => {
      // The callback popup targets this exact origin now (appointments.py's
      // _popup_html), so anything from elsewhere is not ours. Without this,
      // any other window could post a fake FINISH.
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'GOOGLE_AUTH') {
        if (event.data.event === 'FINISH') {
          setGoogleConnecting(false)
          fetchData()
        } else if (event.data.event === 'ERROR') {
          setGoogleConnecting(false)
          toast.error('Google Calendar connection failed: ' + event.data.error)
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const connectGoogle = async () => {
    setGoogleConnecting(true)
    try {
      const res = await fetch(`/api/appointments/google/auth/${projectId}`)
      const data = await res.json()
      if (data.auth_url) {
        window.open(data.auth_url, 'google-auth', 'width=500,height=600')
      }
    } catch (e) {
      setGoogleConnecting(false)
      toast.error('Failed to start Google auth')
    }
  }

  const disconnectGoogle = async () => {
    await fetch(`/api/appointments/google/disconnect/${projectId}`, { method: 'DELETE' })
    fetchData()
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/appointment-settings/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Failed to save')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      toast.error(e.message || 'Failed to save')
    }
    setSaving(false)
  }

  const updateAppointment = async (id, status) => {
    if (status === 'cancelled' || status === 'declined') {
      const ok = await confirmDialog({
        title: status === 'declined' ? 'Decline this request?' : 'Cancel this appointment?',
        description: 'The customer is told on WhatsApp and the time slot becomes free again.',
        confirmText: status === 'declined' ? 'Decline' : 'Cancel appointment',
      })
      if (!ok) return
    }
    await fetch(`/api/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchData()
  }

  const statusBadge = (status) => {
    const map = {
      confirmed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-600',
      completed: 'bg-blue-100 text-blue-700',
      rescheduled: 'bg-yellow-100 text-yellow-700',
      pending_approval: 'bg-amber-100 text-amber-700',
      declined: 'bg-gray-100 text-gray-600',
      no_show: 'bg-gray-100 text-gray-600',
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {String(status).replace('_', ' ')}
      </span>
    )
  }

  const bookingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${settings?.booking_slug || projectId}`

  // Date-grouped agenda view, anchored to today — the pattern every
  // booking tool (Calendly, Cal.com, Setmore) actually uses for
  // day-to-day management, since a flat list stops scaling fast.
  const todayStr = new Date().toISOString().slice(0, 10)

  // A reschedule is one booking across two rows: show only the newest, with
  // the earlier time on its card.
  const apptById = new Map(appointments.map(a => [a.id, a]))
  const replacedIds = new Set(appointments.map(a => a.rescheduled_from).filter(Boolean))
  const visibleAppointments = appointments.filter(a => !replacedIds.has(a.id))
  const shortTime = (t) => String(t).slice(0, 5)

  const statusCounts = {
    pending: appointments.filter(a => a.status === 'pending_approval').length,
    today: appointments.filter(a => a.status === 'confirmed' && a.appointment_date === todayStr).length,
    upcoming: appointments.filter(a => a.status === 'confirmed' && a.appointment_date >= todayStr).length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    all: visibleAppointments.length,
  }

  const filteredAppointments = visibleAppointments.filter(appt => {
    // A 'rescheduled' row is the old time; its replacement is a new row.
    if (statusFilter === 'pending' && appt.status !== 'pending_approval') return false
    if (statusFilter === 'today' && !(appt.status === 'confirmed' && appt.appointment_date === todayStr)) return false
    if (statusFilter === 'upcoming' && !(appt.status === 'confirmed' && appt.appointment_date >= todayStr)) return false
    if (statusFilter === 'completed' && appt.status !== 'completed') return false
    if (statusFilter === 'cancelled' && appt.status !== 'cancelled') return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (!appt.customer_name?.toLowerCase().includes(q) && !appt.customer_phone?.includes(q)) return false
    }
    return true
  })

  // Upcoming/all: soonest first. Completed/cancelled: most recent first —
  // reads like a history log, matching how Cal.com's Past tab behaves.
  const chronological = statusFilter === 'completed' || statusFilter === 'cancelled' ? -1 : 1
  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    const cmp = a.appointment_date.localeCompare(b.appointment_date) || a.start_time.localeCompare(b.start_time)
    return cmp * chronological
  })

  const formatDateHeader = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const diffDays = Math.round((d - today) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays === -1) return 'Yesterday'
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    })
  }

  // Calendar grid view — a real month view, added alongside (not instead
  // of) the agenda list. Cal.com added this exact thing in 2026 as a
  // second, optional view layered on their list, specifically so people
  // can spot gaps across a week at a glance — the agenda list already
  // covers day-to-day management well on its own.
  const statusDotColor = {
    confirmed: 'bg-green-500',
    cancelled: 'bg-red-500',
    completed: 'bg-blue-500',
    rescheduled: 'bg-yellow-500',
  }

  const toDateStr = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i))
    return days
  }

  const apptsForDay = (dateStr) => filteredAppointments.filter(a => a.appointment_date === dateStr)

  const renderApptCard = (appt) => (
    <div key={appt.id} className="border rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">{appt.customer_name}</p>
          <p className="text-xs text-muted-foreground">+{appt.customer_phone}</p>
        </div>
        {statusBadge(appt.status)}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock size={11} /> {formatDateHeader(appt.appointment_date)}, {shortTime(appt.start_time)} – {shortTime(appt.end_time)}</span>
      </div>
      {apptById.get(appt.rescheduled_from) && (
        <p className="text-xs text-amber-700">
          Rescheduled from {formatDateHeader(apptById.get(appt.rescheduled_from).appointment_date)}, {shortTime(apptById.get(appt.rescheduled_from).start_time)}
        </p>
      )}
      {(appt.answers || []).length > 0 && (
        <div className="text-xs bg-gray-50 rounded-lg px-3 py-2 space-y-0.5">
          {appt.answers.map((a, i) => <p key={i}><span className="text-gray-500">{a.question}:</span> {a.answer}</p>)}
        </div>
      )}
      {appt.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{appt.notes}</p>}
      {appt.status === 'pending_approval' && (
        <div className="flex gap-2">
          <button onClick={() => updateAppointment(appt.id, 'confirmed')}
            className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5">
            <Check size={11} /> Approve
          </button>
          <button onClick={() => updateAppointment(appt.id, 'declined')}
            className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5">
            <X size={11} /> Decline
          </button>
        </div>
      )}
      {appt.status === 'confirmed' && (
        <div className="flex gap-2">
          <button onClick={() => updateAppointment(appt.id, 'completed')}
            className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5">
            <Check size={11} /> Mark Complete
          </button>
          <button onClick={() => updateAppointment(appt.id, 'cancelled')}
            className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5">
            <X size={11} /> Cancel
          </button>
          {appt.appointment_date <= todayStr && (
            <button onClick={() => updateAppointment(appt.id, 'no_show')}
              className="flex items-center gap-1 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5">
              No-show
            </button>
          )}
        </div>
      )}
    </div>
  )

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading appointments...</div>

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Appointments</h2>
          <p className="text-sm text-muted-foreground">Manage bookings and availability</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowManual(true)} className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-1.5">
            <Plus size={13} /> Add booking
          </button>
          <button onClick={fetchData} className="border rounded-lg px-3 py-2 text-sm hover:bg-muted flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Booking URL */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-indigo-800">Your booking link</p>
          <p className="text-xs text-indigo-600 font-mono mt-0.5 truncate max-w-xs">{bookingUrl}</p>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(bookingUrl)}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg shrink-0">
          Copy
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'appointments', label: 'Appointments' },
          { key: 'services', label: 'Services' },
          { key: 'availability', label: 'Availability' },
          { key: 'notifications', label: 'Notifications' },
          { key: 'settings', label: 'Settings' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-muted-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Appointments tab */}
      {showManual && <ManualBooking projectId={projectId} services={services} onClose={() => setShowManual(false)} onDone={() => { setShowManual(false); fetchData() }} />}

      {activeTab === 'appointments' && (
        <div className="space-y-4">
          {/* Status tabs + search + view toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex gap-1 flex-wrap">
              {[
                { key: 'today', label: 'Today' },
                { key: 'pending', label: 'Needs approval' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'completed', label: 'Completed' },
                { key: 'cancelled', label: 'Cancelled' },
                { key: 'all', label: 'All' },
              ].map(t => (
                <button key={t.key} onClick={() => setStatusFilter(t.key)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    statusFilter === t.key
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-muted-foreground border-gray-200 hover:bg-muted/50'
                  }`}>
                  {t.label} <span className="opacity-70">({statusCounts[t.key]})</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name or phone"
                  className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div className="flex border rounded-lg overflow-hidden shrink-0">
                <button onClick={() => setViewMode('agenda')}
                  title="Agenda list"
                  className={`px-2.5 py-1.5 flex items-center ${viewMode === 'agenda' ? 'bg-indigo-600 text-white' : 'bg-white text-muted-foreground hover:bg-muted/50'}`}>
                  <List size={14} />
                </button>
                <button onClick={() => setViewMode('calendar')}
                  title="Calendar"
                  className={`px-2.5 py-1.5 flex items-center border-l ${viewMode === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-white text-muted-foreground hover:bg-muted/50'}`}>
                  <CalendarDays size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Date-grouped agenda list */}
          {viewMode === 'agenda' && (
            sortedAppointments.length === 0 ? (
              <div className="text-center py-12 border rounded-xl text-sm text-muted-foreground">
                {appointments.length === 0
                  ? 'No appointments yet. Share your booking link to get started.'
                  : 'No appointments match this filter.'}
              </div>
            ) : (
              <div className="space-y-5">
                {sortedAppointments.map((appt, i) => {
                  const showHeader = i === 0 || sortedAppointments[i - 1].appointment_date !== appt.appointment_date
                  return (
                    <div key={appt.id}>
                      {showHeader && (
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-1">
                          {formatDateHeader(appt.appointment_date)}
                        </p>
                      )}
                      {renderApptCard(appt)}
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Calendar grid view */}
          {viewMode === 'calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
              <div className="border rounded-xl bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="font-semibold text-sm">
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted">
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-[10px] text-muted-foreground font-medium py-1">{d}</div>
                  ))}
                  {getDaysInMonth(calendarMonth).map((date, i) => {
                    if (!date) return <div key={i} />
                    const dateStr = toDateStr(date)
                    const dayAppts = apptsForDay(dateStr)
                    const isToday = dateStr === todayStr
                    const isSelected = selectedDay === dateStr
                    return (
                      <button key={i} onClick={() => setSelectedDay(dateStr)}
                        className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start gap-1 border transition-colors ${
                          isSelected ? 'border-indigo-600 bg-indigo-50' :
                          isToday ? 'border-indigo-200 bg-indigo-50/50' :
                          'border-transparent hover:bg-muted/50'
                        }`}>
                        <span className={`text-xs ${isToday ? 'font-bold text-indigo-600' : 'text-gray-700'}`}>
                          {date.getDate()}
                        </span>
                        {dayAppts.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 justify-center items-center">
                            {dayAppts.slice(0, 3).map(a => (
                              <span key={a.id} className={`w-1.5 h-1.5 rounded-full ${statusDotColor[a.status] || 'bg-gray-400'}`} />
                            ))}
                            {dayAppts.length > 3 && (
                              <span className="text-[9px] text-muted-foreground leading-none">+{dayAppts.length - 3}</span>
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t flex-wrap">
                  {Object.entries(statusDotColor).map(([status, color]) => (
                    <span key={status} className="flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
                      <span className={`w-1.5 h-1.5 rounded-full ${color}`} /> {status}
                    </span>
                  ))}
                </div>
              </div>

              {/* Selected day detail panel */}
              <div className="space-y-3">
                {selectedDay ? (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {formatDateHeader(selectedDay)}
                    </p>
                    {apptsForDay(selectedDay).length === 0 ? (
                      <div className="text-center py-8 border rounded-xl text-sm text-muted-foreground">
                        No appointments on this day.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {apptsForDay(selectedDay).map(appt => renderApptCard(appt))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 border rounded-xl text-sm text-muted-foreground">
                    Click a date to see its appointments.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Services tab — Calendly-style event types: what customers can book */}
      {activeTab === 'services' && (
        <div className="space-y-6">
          <div className="border rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Services</p>
                <p className="text-xs text-muted-foreground">What customers can book — each can have its own duration</p>
              </div>
              <button onClick={openNewServiceForm}
                className="flex items-center gap-1 text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5">
                <Plus size={12} /> Add Service
              </button>
            </div>

            {services.some(s => s.payment_mode !== 'free') && !razorpayConnected && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                One or more services collect payment, but Razorpay isn't connected yet — connect it in the
                Integrations tab so customers can actually pay.
              </p>
            )}

            {services.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No services yet — add one so customers can book.</p>
            ) : (
              <div className="space-y-2">
                {services.map(svc => (
                  <div key={svc.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {svc.name}
                        {!svc.is_active && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Inactive</span>}
                        {svc.is_hidden && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">Hidden</span>}
                        {svc.requires_approval && <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full">Needs approval</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[svc.duration_minutes, ...(svc.duration_options || [])].sort((a, b) => a - b).join(' / ')} min
                        {svc.payment_mode !== 'free' ? ` · ₹${svc.price} (${svc.payment_mode === 'hold_to_confirm' ? 'pay to confirm' : 'pay after'})` : ' · Free'}
                        {svc.description ? ` · ${svc.description}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => navigator.clipboard?.writeText(`${bookingUrl}?service=${svc.id}`)} title="Copy this service's own booking link" className="text-xs text-gray-500 hover:underline">Copy link</button>
                      <button onClick={() => openEditServiceForm(svc)} title="Edit" className="text-gray-400 hover:text-gray-700"><Pencil size={13} /></button>
                      <button onClick={() => toggleServiceActive(svc)} className="text-xs text-gray-500 hover:underline">
                        {svc.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => deleteServiceHandler(svc)} title="Delete" className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showServiceForm && (
              <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
                <input placeholder="Service name" className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={serviceForm.name} onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                <textarea placeholder="Description (optional)" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  value={serviceForm.description} onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))} />
                <NumberField label="Duration (minutes)" min={5} max={1440} fallback={30} value={serviceForm.duration_minutes}
                  onChange={v => setServiceForm(f => ({ ...f, duration_minutes: v }))} />
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Payment</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    value={serviceForm.payment_mode}
                    onChange={e => setServiceForm(f => ({ ...f, payment_mode: e.target.value }))}>
                    {Object.entries(PAYMENT_MODE_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </div>
                {serviceForm.payment_mode !== 'free' && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Price (₹)</label>
                    <input type="number" min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={serviceForm.price}
                      onChange={e => setServiceForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                  </div>
                )}
                <ServiceOptions form={serviceForm} setForm={setServiceForm} schedules={schedules} projectId={projectId} serviceId={editingService?.id} />
                <QuestionsEditor value={serviceForm.questions} onChange={q => setServiceForm(f => ({ ...f, questions: q }))} />
                <ServiceOverrides form={serviceForm} setForm={setServiceForm} />
                <div className="flex gap-2">
                  <button onClick={saveService}
                    disabled={savingService || !serviceForm.name.trim() || (serviceForm.payment_mode !== 'free' && !(serviceForm.price > 0))}
                    className="text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
                    {savingService ? 'Saving...' : editingService ? 'Save Changes' : 'Add Service'}
                  </button>
                  <button onClick={() => setShowServiceForm(false)} className="text-xs border rounded-lg px-3 py-1.5">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Availability tab — named schedules (who's free when) plus the
          business-wide booking rules (buffers, notice, daily limit,
          timezone...). Kept on one tab since both answer "when". */}
      {activeTab === 'availability' && settings && (
        <div className="space-y-6">
          <SchedulesCard projectId={projectId} schedules={schedules} onChanged={fetchData} />

          <div className="border rounded-xl p-4 bg-white space-y-4">
            <p className="text-sm font-semibold">Booking rules</p>
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
              WhatsApp only delivers messages to people who book from your website when they're sent as approved templates.
              Add <strong>Appointment Confirmed</strong>, <strong>Appointment Reminder</strong> and <strong>Appointment Cancelled</strong> in
              {' '}<a href="templates" className="underline font-medium">Templates → Template library</a>.
            </p>
            <BookingRules settings={settings} setSettings={setSettings} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Timezone</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  value={settings.timezone || 'Asia/Kolkata'}
                  onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Used for your working hours and Google Calendar events</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Accent color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.accent_color || '#6366f1'}
                    onChange={e => setSettings(s => ({ ...s, accent_color: e.target.value }))}
                    className="w-10 h-9 rounded border cursor-pointer" />
                  <span className="text-xs text-muted-foreground">{settings.accent_color}</span>
                </div>
              </div>
            </div>
          </div>

          <button onClick={saveSettings} disabled={saving}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* Notifications tab — what customers and the owner get told */}
      {activeTab === 'notifications' && settings && (
        <div className="space-y-6">
          <RemindersEditor settings={settings} setSettings={setSettings} />

          <FollowupCard settings={settings} setSettings={setSettings} />

          {/* WhatsApp alert to the owner */}
          <div className="border rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Booking alerts for you</p>
                <p className="text-xs text-muted-foreground">Get a WhatsApp message when someone books, reschedules or cancels.</p>
              </div>
              <button type="button" onClick={() => setSettings(s => ({ ...s, notify_owner_booking: s.notify_owner_booking === false }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${settings.notify_owner_booking !== false ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings.notify_owner_booking !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {settings.notify_owner_booking !== false && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Your WhatsApp number</label>
                <div className="flex gap-2">
                  <div className="flex items-center border rounded-lg px-2 w-20 shrink-0">
                    <span className="text-sm text-gray-500">+</span>
                    <input type="tel" inputMode="numeric" maxLength={4} aria-label="Country code"
                      value={settings.owner_phone_code ?? '91'}
                      onChange={e => setSettings(s => ({ ...s, owner_phone_code: e.target.value.replace(/\D/g, '') }))}
                      className="w-full py-2 pl-0.5 text-sm outline-none bg-transparent" />
                  </div>
                  <input type="tel" inputMode="numeric" placeholder="98765 43210" aria-label="WhatsApp number"
                    value={settings.owner_phone_number ?? ''}
                    onChange={e => setSettings(s => ({ ...s, owner_phone_number: e.target.value }))}
                    className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                {!settings.owner_phone_number && <p className="text-xs text-amber-600">Add your number to start getting alerts.</p>}
                <p className="text-xs text-muted-foreground">
                  If your phone hasn't messaged this business number in the last 24 hours, WhatsApp only delivers a template: add
                  {' '}<strong>Appointment New Booking Alert (for you)</strong> in{' '}
                  <a href="templates" className="underline font-medium">Templates → Template library</a>.
                </p>
              </div>
            )}
          </div>

          <button onClick={saveSettings} disabled={saving}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && settings && (
        <div className="space-y-6">

          {/* Enable toggle */}
          <div className="flex items-center justify-between border rounded-xl px-4 py-3 bg-white">
            <div>
              <p className="text-sm font-medium">Enable booking</p>
              <p className="text-xs text-muted-foreground">Allow customers to book appointments</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, is_enabled: !s.is_enabled }))}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${settings.is_enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${settings.is_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Let the AI bot book directly in chat — separate from the public booking page above */}
          <div className="flex items-center justify-between border rounded-xl px-4 py-3 bg-white">
            <div>
              <p className="text-sm font-medium">Let the AI book in chat</p>
              <p className="text-xs text-muted-foreground">Your chatbot can check availability and book appointments directly inside a conversation (WhatsApp, Telegram, web chat)</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, bot_can_book: !s.bot_can_book }))}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors shrink-0 ml-4 ${settings.bot_can_book ? 'bg-indigo-600' : 'bg-gray-200'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${settings.bot_can_book ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Google Calendar */}
          <div className="border rounded-xl p-4 bg-white space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#4285F4"/><path d="M7 10h10v2H7zm0 4h7v2H7z" fill="white"/></svg>
              Google Calendar
            </p>
            {settings.google_connected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  <Check size={13} /> Connected — availability synced automatically
                </div>
                <button onClick={disconnectGoogle}
                  className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50">
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Connect your Google Calendar so customers only see slots when you're actually free.</p>
                <button onClick={connectGoogle} disabled={googleConnecting}
                  className="flex items-center gap-2 bg-white border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                  {googleConnecting ? <Loader2 size={13} className="animate-spin" /> : (
                    <svg width="14" height="14" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#4285F4"/></svg>
                  )}
                  Connect Google Calendar
                </button>
              </div>
            )}
          </div>

          <BookingLinkCard settings={settings} setSettings={setSettings} projectId={projectId} />

          <button onClick={saveSettings} disabled={saving}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  )
}