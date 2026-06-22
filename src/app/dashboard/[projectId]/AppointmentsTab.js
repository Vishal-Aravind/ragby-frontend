'use client'
import { useEffect, useState } from 'react'
import { Calendar, Clock, Settings, Check, X, RefreshCw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL

export default function AppointmentsTab({ project }) {
  const projectId = project?.id || project
  const [activeTab, setActiveTab] = useState('appointments')
  const [appointments, setAppointments] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [googleConnecting, setGoogleConnecting] = useState(false)

  const DAYS = [
    { key: 'mon', label: 'Monday' },
    { key: 'tue', label: 'Tuesday' },
    { key: 'wed', label: 'Wednesday' },
    { key: 'thu', label: 'Thursday' },
    { key: 'fri', label: 'Friday' },
    { key: 'sat', label: 'Saturday' },
    { key: 'sun', label: 'Sunday' },
  ]

  const fetchData = async () => {
    setLoading(true)
    try {
      const [apptRes, settingsRes] = await Promise.all([
        fetch(`/api/appointments?projectId=${projectId}`),
        fetch(`/api/appointment-settings/${projectId}`),
      ])
      if (apptRes.ok) setAppointments(await apptRes.json())
      if (settingsRes.ok) setSettings(await settingsRes.json())
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [projectId])

  // Listen for Google OAuth popup callback
  useEffect(() => {
    const handler = async (event) => {
      if (event.data?.type === 'GOOGLE_AUTH') {
        if (event.data.event === 'FINISH') {
          setGoogleConnecting(false)
          fetchData()
        } else if (event.data.event === 'ERROR') {
          setGoogleConnecting(false)
          alert('Google Calendar connection failed: ' + event.data.error)
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
      alert('Failed to start Google auth')
    }
  }

  const disconnectGoogle = async () => {
    await fetch(`/api/appointments/google/disconnect/${projectId}`, { method: 'DELETE' })
    fetchData()
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await fetch(`/api/appointment-settings/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert('Failed to save')
    }
    setSaving(false)
  }

  const updateWorkingHours = (day, field, value) => {
    setSettings(s => ({
      ...s,
      working_hours: {
        ...s.working_hours,
        [day]: { ...s.working_hours[day], [field]: value }
      }
    }))
  }

  const updateAppointment = async (id, status) => {
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
    }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    )
  }

  const bookingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${projectId}`

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
      {activeTab === 'appointments' && (
        <div className="space-y-3">
          {appointments.length === 0 ? (
            <div className="text-center py-12 border rounded-xl text-sm text-muted-foreground">
              No appointments yet. Share your booking link to get started.
            </div>
          ) : (
            appointments.map(appt => (
              <div key={appt.id} className="border rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{appt.customer_name}</p>
                    <p className="text-xs text-muted-foreground">+{appt.customer_phone}</p>
                  </div>
                  {statusBadge(appt.status)}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar size={11} /> {appt.appointment_date}</span>
                  <span className="flex items-center gap-1"><Clock size={11} /> {appt.start_time} – {appt.end_time}</span>
                </div>
                {appt.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{appt.notes}</p>}
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
                  </div>
                )}
              </div>
            ))
          )}
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

          {/* Service details */}
          <div className="border rounded-xl p-4 bg-white space-y-4">
            <p className="text-sm font-semibold">Service details</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs text-muted-foreground">Service name</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={settings.service_name || ''} onChange={e => setSettings(s => ({ ...s, service_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Duration (minutes)</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  value={settings.duration_minutes}
                  onChange={e => setSettings(s => ({ ...s, duration_minutes: parseInt(e.target.value) }))}>
                  {[15, 20, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Buffer between slots</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  value={settings.buffer_minutes}
                  onChange={e => setSettings(s => ({ ...s, buffer_minutes: parseInt(e.target.value) }))}>
                  {[0, 5, 10, 15, 30].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Advance booking (days)</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  value={settings.advance_booking_days}
                  onChange={e => setSettings(s => ({ ...s, advance_booking_days: parseInt(e.target.value) }))}>
                  {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Reminder before (hours)</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  value={settings.reminder_hours}
                  onChange={e => setSettings(s => ({ ...s, reminder_hours: parseInt(e.target.value) }))}>
                  {[1, 2, 3, 6, 12, 24, 48].map(d => <option key={d} value={d}>{d}h before</option>)}
                </select>
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

          {/* Working hours */}
          <div className="border rounded-xl p-4 bg-white space-y-3">
            <p className="text-sm font-semibold">Working hours</p>
            <div className="space-y-2">
              {DAYS.map(({ key, label }) => {
                const day = settings.working_hours?.[key] || { enabled: false, start: "09:00", end: "18:00" }
                return (
                  <div key={key} className="flex items-center gap-3">
                    <button
                      onClick={() => updateWorkingHours(key, 'enabled', !day.enabled)}
                      className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors shrink-0 ${day.enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${day.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <span className={`text-xs w-20 shrink-0 ${day.enabled ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{label}</span>
                    {day.enabled && (
                      <div className="flex items-center gap-2 flex-1">
                        <input type="time" value={day.start}
                          onChange={e => updateWorkingHours(key, 'start', e.target.value)}
                          className="border rounded px-2 py-1 text-xs flex-1" />
                        <span className="text-xs text-gray-400">to</span>
                        <input type="time" value={day.end}
                          onChange={e => updateWorkingHours(key, 'end', e.target.value)}
                          className="border rounded px-2 py-1 text-xs flex-1" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <button onClick={saveSettings} disabled={saving}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  )
}