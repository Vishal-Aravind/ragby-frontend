'use client'
import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// The owner adds a booking by hand (a phone call, a walk-in). It is confirmed
// straight away and the customer gets the usual WhatsApp confirmation.
export default function ManualBooking({ projectId, services, onClose, onDone }) {
  const active = services.filter(s => s.is_active)
  const [serviceId, setServiceId] = useState(active[0]?.id || '')
  const service = active.find(s => s.id === serviceId)
  const lengths = service ? [...new Set([service.duration_minutes, ...(service.duration_options || [])])].sort((a, b) => a - b) : []
  const [duration, setDuration] = useState(null)
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [time, setTime] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('91')
  const [number, setNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const effectiveDuration = duration && service && duration !== service.duration_minutes ? duration : null

  useEffect(() => {
    setTime('')
    if (!date || !serviceId) { setSlots([]); return }
    setSlotsLoading(true)
    const qs = new URLSearchParams({ date, service_id: serviceId })
    if (effectiveDuration) qs.set('duration', String(effectiveDuration))
    fetch(`/api/public/appointments/${projectId}/slots?${qs}`)
      .then(r => r.json())
      .then(d => setSlots((d.slots || []).map(s => s.split(' ')[0])))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [date, serviceId, effectiveDuration])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/appointments/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId, service_id: serviceId, customer_name: name.trim(),
          customer_phone: `+${code}${number.replace(/\D/g, '')}`, appointment_date: date, start_time: time,
          duration_minutes: effectiveDuration, notes: notes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : data.error || 'Could not add the booking')
      onDone()
    } catch (e) {
      toast.error(e.message)
    }
    setSaving(false)
  }

  const field = 'w-full border rounded-lg px-3 py-2 text-sm bg-white'
  const ready = serviceId && date && time && name.trim() && number.replace(/\D/g, '').length >= 6

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Add a booking</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a service first (Settings → Services).</p>
        ) : (
          <>
            <select className={field} value={serviceId} onChange={e => { setServiceId(e.target.value); setDuration(null) }}>
              {active.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {lengths.length > 1 && (
              <select className={field} value={duration || service.duration_minutes} onChange={e => setDuration(parseInt(e.target.value))}>
                {lengths.map(m => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            )}
            <input type="date" className={field} value={date} onChange={e => setDate(e.target.value)} />
            {date && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Available times</p>
                {slotsLoading ? <Loader2 size={14} className="animate-spin text-gray-400" /> : slots.length === 0 ? (
                  <p className="text-xs text-gray-500">No free times on this date. Check your schedule and booking rules.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map(t => (
                      <button key={t} type="button" onClick={() => setTime(t)}
                        className={`text-xs border rounded-lg px-2.5 py-1 ${time === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white'}`}>{t}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <input className={field} placeholder="Customer name" maxLength={120} value={name} onChange={e => setName(e.target.value)} />
            <div className="flex gap-2">
              <div className="flex items-center border rounded-lg px-2 w-20 shrink-0">
                <span className="text-sm text-gray-500">+</span>
                <input type="tel" inputMode="numeric" maxLength={4} aria-label="Country code" value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className="w-full py-2 pl-0.5 text-sm outline-none bg-transparent" />
              </div>
              <input type="tel" inputMode="numeric" placeholder="WhatsApp number" aria-label="Phone number" value={number}
                onChange={e => setNumber(e.target.value)} className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <textarea className={field + ' resize-none'} rows={2} placeholder="Notes (optional)" maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} />
            <p className="text-xs text-muted-foreground">Confirmed straight away. The customer gets the WhatsApp confirmation. Payment isn't collected here.</p>
            <button onClick={save} disabled={saving || !ready}
              className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
              {saving ? 'Adding...' : 'Add booking'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
