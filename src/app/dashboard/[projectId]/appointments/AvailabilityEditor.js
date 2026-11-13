'use client'
import { useState } from 'react'
import { Plus, X, Copy } from 'lucide-react'

// Calendly-style availability: several time ranges a day, date-specific hours,
// and the booking rules (buffers, start interval, notice, limits). Used by the
// project settings and, for the per-service overrides, by the service form.

const DAYS = [
  { key: 'mon', label: 'Monday' }, { key: 'tue', label: 'Tuesday' }, { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' }, { key: 'fri', label: 'Friday' }, { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm bg-white'

const toMin = (t) => { const [h, m] = String(t || '0:0').split(':'); return (parseInt(h) || 0) * 60 + (parseInt(m) || 0) }
const fromMin = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

export function windowsOf(day) {
  if (day?.windows?.length) return day.windows
  return [{ start: day?.start || '09:00', end: day?.end || '18:00' }]
}

// Two ranges overlap or one ends before it starts: shown in red, the server checks again on save
function windowProblem(windows) {
  const list = windows.map(w => [toMin(w.start), toMin(w.end)])
  if (list.some(([s, e]) => e <= s)) return 'A range must end after it starts'
  const sorted = [...list].sort((a, b) => a[0] - b[0])
  for (let i = 1; i < sorted.length; i++) if (sorted[i][0] < sorted[i - 1][1]) return 'Time ranges overlap'
  return null
}

function nextWindow(windows) {
  const last = windows[windows.length - 1]
  const start = Math.min(toMin(last?.end || '17:00'), 23 * 60)
  return { start: fromMin(start), end: fromMin(Math.min(start + 120, 23 * 60 + 59)) }
}

// Small "i" bubble: hover (or tap on mobile) to show a plain-language
// explainer next to a field label, for fields whose name alone isn't
// enough to know what to put in them.
export function InfoTip({ text }) {
  return (
    <span className="relative inline-flex group/tip align-middle ml-1">
      <span tabIndex={0} className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-300 text-gray-400 text-[9px] leading-none cursor-help select-none focus:outline-none focus:ring-1 focus:ring-indigo-300">i</span>
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-56 rounded-lg bg-gray-900 text-white text-[11px] leading-snug px-2.5 py-1.5 opacity-0 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 transition-opacity z-20">
        {text}
      </span>
    </span>
  )
}

export function NumberField({ label, tip, hint, value, onChange, min = 0, max, placeholder, nullable = false, fallback = 0 }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground inline-flex items-center">{label}{tip && <InfoTip text={tip} />}</label>
      <input type="number" step="1" min={min} max={max} placeholder={placeholder} className={inputCls}
        value={value ?? ''}
        onChange={e => {
          if (e.target.value === '') return onChange(nullable ? null : '')
          let n = parseInt(e.target.value)
          if (Number.isNaN(n)) return
          if (max != null) n = Math.min(max, n)
          onChange(Math.max(min, n))
        }}
        onBlur={() => { if (!nullable && (value === '' || value == null)) onChange(fallback) }}
        onWheel={e => e.currentTarget.blur()} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// Minutes, entered as minutes / hours / days
export function DurationField({ label, tip, hint, value, onChange, placeholder, nullable = false }) {
  const [unit, setUnit] = useState(() => (value && value % 1440 === 0 ? 1440 : value && value % 60 === 0 ? 60 : 1))
  const shown = value == null || value === '' ? '' : Math.round((value / unit) * 100) / 100
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground inline-flex items-center">{label}{tip && <InfoTip text={tip} />}</label>
      <div className="flex gap-2">
        <input type="number" min="0" step="any" placeholder={placeholder} className={inputCls} value={shown}
          onChange={e => {
            if (e.target.value === '') return onChange(nullable ? null : 0)
            const n = parseFloat(e.target.value)
            if (!Number.isNaN(n)) onChange(Math.max(0, Math.round(n * unit)))
          }}
          onWheel={e => e.currentTarget.blur()} />
        <select className="border rounded-lg px-2 text-sm bg-white" value={unit} onChange={e => setUnit(parseInt(e.target.value))}>
          <option value={1}>minutes</option>
          <option value={60}>hours</option>
          <option value={1440}>days</option>
        </select>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function WindowRows({ windows, onChange }) {
  const set = (i, patch) => onChange(windows.map((w, j) => (j === i ? { ...w, ...patch } : w)))
  return (
    <div className="space-y-1.5 flex-1">
      {windows.map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="time" value={w.start} onChange={e => set(i, { start: e.target.value })} className="border rounded px-2 py-1 text-xs flex-1 min-w-0" />
          <span className="text-xs text-gray-400">to</span>
          <input type="time" value={w.end} onChange={e => set(i, { end: e.target.value })} className="border rounded px-2 py-1 text-xs flex-1 min-w-0" />
          {windows.length > 1 && (
            <button type="button" title="Remove" onClick={() => onChange(windows.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600">
              <X size={13} />
            </button>
          )}
        </div>
      ))}
      {windowProblem(windows) && <p className="text-[11px] text-red-600">{windowProblem(windows)}</p>}
    </div>
  )
}

export function WorkingHoursEditor({ value, onChange }) {
  const hours = value || {}
  const setDay = (key, patch) =>
    onChange({ ...hours, [key]: { enabled: false, start: '09:00', end: '18:00', ...(hours[key] || {}), ...patch } })
  const setWindows = (key, windows) => setDay(key, { windows, start: windows[0]?.start, end: windows[windows.length - 1]?.end })
  const copyToAll = (key) => {
    const src = windowsOf(hours[key])
    const next = { ...hours }
    DAYS.forEach(({ key: k }) => {
      if (k !== key && hours[k]?.enabled) next[k] = { ...hours[k], windows: src.map(w => ({ ...w })), start: src[0].start, end: src[src.length - 1].end }
    })
    onChange(next)
  }
  return (
    <div className="space-y-2">
      {DAYS.map(({ key, label }) => {
        const day = hours[key] || { enabled: false, start: '09:00', end: '18:00' }
        const windows = windowsOf(day)
        return (
          <div key={key} className="flex items-start gap-3">
            <button type="button" onClick={() => setDay(key, { enabled: !day.enabled })}
              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors shrink-0 mt-1.5 ${day.enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${day.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-xs w-20 shrink-0 mt-1.5 ${day.enabled ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{label}</span>
            {day.enabled ? (
              <>
                <WindowRows windows={windows} onChange={w => setWindows(key, w)} />
                <div className="flex items-center gap-2 shrink-0 mt-1.5">
                  <button type="button" title="Add another time range (for example after a lunch break)"
                    onClick={() => setWindows(key, [...windows, nextWindow(windows)])} className="text-gray-400 hover:text-indigo-600">
                    <Plus size={14} />
                  </button>
                  <button type="button" title="Copy these hours to all other open days" onClick={() => copyToAll(key)} className="text-gray-400 hover:text-indigo-600">
                    <Copy size={13} />
                  </button>
                </div>
              </>
            ) : <span className="text-xs text-gray-400 mt-1.5">Unavailable</span>}
          </div>
        )
      })}
      <p className="text-[11px] text-muted-foreground pt-1">
        Use <strong>+</strong> to add a second range, like 9–12 and 2–5 with a lunch break. The copy icon applies a day's hours to every other open day.
      </p>
    </div>
  )
}

const today = () => new Date().toISOString().slice(0, 10)
const prettyDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export function DateOverridesEditor({ value, onChange }) {
  const list = [...(value || [])].sort((a, b) => a.date.localeCompare(b.date))
  const [draft, setDraft] = useState(null)

  const save = () => {
    if (!draft?.date) return
    const entry = { date: draft.date, closed: draft.closed, ...(draft.note.trim() ? { note: draft.note.trim() } : {}) }
    if (!draft.closed) entry.windows = draft.windows
    onChange([...list.filter(o => o.date !== draft.date), entry])
    setDraft(null)
  }

  return (
    <div className="space-y-2">
      {list.length === 0 && <p className="text-xs text-muted-foreground">No special dates. Add a holiday or a day with different hours.</p>}
      {list.map(o => (
        <div key={o.date} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="font-medium text-gray-800">{prettyDate(o.date)}{o.note ? ` · ${o.note}` : ''}</p>
            <p className="text-muted-foreground">{o.closed ? 'Closed' : (o.windows || []).map(w => `${w.start}–${w.end}`).join(', ')}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" className="text-gray-500 hover:underline"
              onClick={() => setDraft({ date: o.date, closed: !!o.closed, windows: o.windows?.length ? o.windows : [{ start: '09:00', end: '13:00' }], note: o.note || '' })}>Edit</button>
            <button type="button" title="Remove" onClick={() => onChange(list.filter(x => x.date !== o.date))} className="text-gray-400 hover:text-red-600"><X size={13} /></button>
          </div>
        </div>
      ))}

      {draft ? (
        <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" min={today()} value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} className={inputCls} />
            <select className={inputCls} value={draft.closed ? 'closed' : 'open'} onChange={e => setDraft(d => ({ ...d, closed: e.target.value === 'closed' }))}>
              <option value="closed">Closed all day</option>
              <option value="open">Different hours</option>
            </select>
          </div>
          {!draft.closed && <WindowRows windows={draft.windows} onChange={w => setDraft(d => ({ ...d, windows: w }))} />}
          {!draft.closed && (
            <button type="button" className="text-xs text-indigo-600 hover:underline"
              onClick={() => setDraft(d => ({ ...d, windows: [...d.windows, nextWindow(d.windows)] }))}>+ Add another time range</button>
          )}
          <input placeholder="Note (optional), e.g. Diwali" maxLength={80} value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} className={inputCls} />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={!draft.date || (!draft.closed && !!windowProblem(draft.windows))}
              className="text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">Add date</button>
            <button type="button" onClick={() => setDraft(null)} className="text-xs border rounded-lg px-3 py-1.5">Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setDraft({ date: '', closed: true, windows: [{ start: '09:00', end: '13:00' }], note: '' })}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"><Plus size={12} /> Add a date</button>
      )}
    </div>
  )
}

// Project-wide booking rules
export function BookingRules({ settings, setSettings }) {
  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }))
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <NumberField label="Buffer before each appointment (min)" min={0} max={240} value={settings.buffer_before_minutes ?? 0}
        onChange={v => set('buffer_before_minutes', v)} hint="Free time kept before a booking" />
      <NumberField label="Buffer after each appointment (min)" min={0} max={240} value={settings.buffer_minutes ?? 0}
        onChange={v => set('buffer_minutes', v)} hint="Free time kept after a booking" />
      <NumberField label="Start a slot every (min)" min={5} max={720} nullable placeholder="Back to back" value={settings.slot_interval_minutes}
        onChange={v => set('slot_interval_minutes', v)} hint="Empty = one slot right after the other. 15 = slots at :00, :15, :30, :45" />
      <DurationField label="Minimum notice" value={settings.min_notice_minutes ?? 0} onChange={v => set('min_notice_minutes', v ?? 0)}
        hint="How long before a slot people can still book it. 0 = any time" />
      <NumberField label="Max bookings per day" min={1} max={1000} nullable placeholder="No limit" value={settings.max_per_day}
        onChange={v => set('max_per_day', v)} hint="Empty = no limit" />
      <NumberField label="Customers can cancel or reschedule until (hours before)" min={0} max={720} nullable placeholder="Any time"
        value={settings.cancel_cutoff_hours} onChange={v => set('cancel_cutoff_hours', v)}
        hint="Empty = any time. 24 = not within 24 hours of the slot. Your own cancellations from the dashboard are never limited." />
      <NumberField label="Book up to how many days ahead" min={1} max={365} fallback={30} value={settings.advance_booking_days}
        onChange={v => set('advance_booking_days', v)}
        tip="How far into the future customers can see and book slots, business-wide. A service left on 'Same as the main settings' in its own booking-window option uses this number." />
      <NumberField label="Capacity per slot" min={1} max={100} fallback={1} value={settings.slot_capacity}
        onChange={v => set('slot_capacity', v)} hint="How many bookings can share one time slot (1–100)" />
    </div>
  )
}

// Per-service overrides. Empty = use the project setting above.
export function ServiceOverrides({ form, setForm }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <details className="border rounded-lg bg-white">
      <summary className="cursor-pointer text-xs font-medium px-3 py-2">Advanced: different rules for this service</summary>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t">
        <NumberField label="Capacity per slot" min={1} max={100} nullable placeholder="Same as settings" value={form.slot_capacity}
          onChange={v => set('slot_capacity', v)} hint="For example 10 for a group class"
          tip="How many separate bookings can share the exact same time slot for this service, instead of your overall settings value. Use this for group classes or shared sessions." />
        <NumberField label="Start a slot every (min)" min={5} max={720} nullable placeholder="Same as settings" value={form.slot_interval_minutes}
          onChange={v => set('slot_interval_minutes', v)}
          tip="How far apart this service's bookable start times are, instead of your overall settings value. 15 = slots at :00, :15, :30, :45." />
        <NumberField label="Buffer before (min)" min={0} max={240} nullable placeholder="Same as settings" value={form.buffer_before_minutes}
          onChange={v => set('buffer_before_minutes', v)}
          tip="Free time blocked off right before each booking of this service, instead of your overall settings value — e.g. time to get set up." />
        <NumberField label="Buffer after (min)" min={0} max={240} nullable placeholder="Same as settings" value={form.buffer_after_minutes}
          onChange={v => set('buffer_after_minutes', v)}
          tip="Free time blocked off right after each booking of this service, instead of your overall settings value — e.g. cleanup or travel time." />
        <DurationField label="Minimum notice" nullable placeholder="Same as settings" value={form.min_notice_minutes}
          onChange={v => set('min_notice_minutes', v)}
          tip="How far in advance this service must be booked, instead of your overall settings value. 0 = can be booked right up until it starts." />
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs text-muted-foreground">Only these start times (optional)</label>
          <input className={inputCls} placeholder="e.g. 09:00, 11:30, 15:00" value={form.fixed_times_text || ''}
            onChange={e => set('fixed_times_text', e.target.value)} />
          <p className="text-xs text-muted-foreground">Offer exactly these times, inside your working hours, instead of generating them. Empty = automatic.</p>
        </div>
      </div>
    </details>
  )
}


// Per-service: schedule, booking window, daily limit, hidden
export function ServiceOptions({ form, setForm, schedules, projectId, serviceId }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const type = form.booking_window_type || ''
  const link = serviceId && typeof window !== 'undefined' ? `${window.location.origin}/book/${projectId}?service=${serviceId}` : ''
  return (
    <div className="space-y-3 border rounded-lg bg-white p-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground inline-flex items-center">
          Schedule (when it can be booked)
          <InfoTip text="Which working hours this service follows. Leave on Default unless you've made a separate schedule — like Evenings only — in the Availability tab and want this service to use it instead." />
        </label>
        <select className={inputCls} value={form.schedule_id || ''} onChange={e => set('schedule_id', e.target.value || null)}>
          <option value="">Default schedule</option>
          {schedules.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_default ? ' (default)' : ''}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground inline-flex items-center">
          How far ahead can people book?
          <InfoTip text="How many days into the future this service's slots are open for booking. 'Same as the main settings' uses the business-wide limit set in Availability → Booking rules. Pick a different option here only if this one service needs its own limit." />
        </label>
        <select className={inputCls} value={type} onChange={e => set('booking_window_type', e.target.value || null)}>
          <option value="">Same as the main settings</option>
          <option value="rolling">The next N days</option>
          <option value="range">Between two dates</option>
          <option value="indefinite">No end date</option>
        </select>
        {type === 'rolling' && (
          <NumberField label="Days ahead" min={1} max={730} fallback={30} value={form.booking_window_days} onChange={v => set('booking_window_days', v)} />
        )}
        {type === 'range' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <input type="date" className={inputCls} value={form.booking_window_start || ''} onChange={e => set('booking_window_start', e.target.value || null)} />
            <input type="date" className={inputCls} value={form.booking_window_end || ''} onChange={e => set('booking_window_end', e.target.value || null)} />
          </div>
        )}
      </div>

      <NumberField label="Max bookings per day for this service" min={1} max={1000} nullable placeholder="No limit"
        value={form.max_per_day} onChange={v => set('max_per_day', v)}
        tip="Caps how many times just THIS service can be booked in one day — separate from your overall business-wide daily limit. Leave empty for no extra cap." />

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Other lengths customers can choose (minutes)</label>
        <input className={inputCls} placeholder="e.g. 15, 45, 60" disabled={form.payment_mode !== 'free'}
          value={form.duration_options_text || ''} onChange={e => set('duration_options_text', e.target.value)} />
        <p className="text-xs text-muted-foreground">
          {form.payment_mode !== 'free'
            ? 'Only for free services: the price is the same for every length.'
            : `The customer picks one on the booking page, next to this service's own ${form.duration_minutes || 30} minutes. Empty = one length.`}
        </p>
      </div>

      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" className="mt-0.5" checked={!!form.requires_approval} onChange={e => set('requires_approval', e.target.checked)} />
        <span>
          <span className="font-medium">Needs my approval</span>
          <span className="block text-muted-foreground">Bookings stay "pending" and hold their slot until you approve or decline them. Only for free services.</span>
          {form.requires_approval && form.payment_mode !== 'free' && (
            <span className="block text-amber-600">Set the service's payment to Free to use approval.</span>
          )}
        </span>
      </label>

      <NumberField label="Customers can cancel or reschedule until (hours before)" min={0} max={720} nullable placeholder="Same as settings"
        value={form.cancel_cutoff_hours} onChange={v => set('cancel_cutoff_hours', v)}
        tip="How close to the appointment time a customer can still cancel or reschedule it themselves. Empty = any time, right up to the start. 24 = blocked within 24 hours of the slot. Your own changes from the dashboard are never limited." />

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Location or video link (shown in the confirmation)</label>
        <input className={inputCls} maxLength={300} placeholder="e.g. 12 Main Street, Chennai, or a Google Meet link"
          value={form.location || ''} onChange={e => set('location', e.target.value)} />
        <p className="text-xs text-muted-foreground">
          For an online appointment, paste your Zoom or Google Meet link here — it's sent straight to the
          customer in their booking confirmation, so they don't have to ask you for it.
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Message in the confirmation</label>
        <textarea className={inputCls + ' resize-none'} rows={2} maxLength={500} placeholder="e.g. Please bring your previous reports"
          value={form.confirmation_note || ''} onChange={e => set('confirmation_note', e.target.value)} />
        <p className="text-xs text-muted-foreground">
          Sent with the WhatsApp confirmation using the "Appointment Confirmed (with details)" template, and shown on the booking page.
        </p>
      </div>

      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" className="mt-0.5" checked={!!form.is_hidden} onChange={e => set('is_hidden', e.target.checked)} />
        <span>
          <span className="font-medium">Hidden: only bookable through its own link</span>
          <span className="block text-muted-foreground">It won't appear on your main booking page or in the AI chat.</span>
        </span>
      </label>
      {link && (
        <div className="flex items-center gap-2 text-xs">
          <input readOnly value={link} className="flex-1 min-w-0 border rounded px-2 py-1 bg-gray-50" onFocus={e => e.target.select()} />
          <button type="button" onClick={() => navigator.clipboard?.writeText(link)} className="border rounded px-2 py-1">Copy</button>
        </div>
      )}
    </div>
  )
}

// Questions shown on the booking form for one service
export function QuestionsEditor({ value, onChange }) {
  const list = value || []
  const update = (i, patch) => onChange(list.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  return (
    <div className="space-y-2 border rounded-lg bg-white p-3">
      <div>
        <p className="text-xs font-medium">Booking questions</p>
        <p className="text-xs text-muted-foreground">Extra questions on the booking form, like "Reason for visit". Answers show on the appointment.</p>
      </div>
      {list.map((q, i) => (
        <div key={i} className="border rounded-lg p-2 space-y-2 bg-gray-50">
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Question" maxLength={120} value={q.label || ''} onChange={e => update(i, { label: e.target.value })} />
            <button type="button" title="Remove" onClick={() => onChange(list.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><X size={14} /></button>
          </div>
          <div className="flex items-center gap-3">
            <select className="border rounded-lg px-2 py-1 text-xs bg-white" value={q.type || 'text'} onChange={e => update(i, { type: e.target.value })}>
              <option value="text">Short answer</option>
              <option value="textarea">Long answer</option>
              <option value="select">Pick from a list</option>
            </select>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={!!q.required} onChange={e => update(i, { required: e.target.checked })} /> Required
            </label>
          </div>
          {q.type === 'select' && (
            <input className={inputCls} placeholder="Options, separated by commas" value={q.options_text ?? (q.options || []).join(', ')}
              onChange={e => update(i, { options_text: e.target.value, options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })} />
          )}
        </div>
      ))}
      {list.length < 10 && (
        <button type="button" onClick={() => onChange([...list, { id: `q${Date.now().toString(36)}`, label: '', type: 'text', required: false, options: [] }])}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"><Plus size={12} /> Add a question</button>
      )}
    </div>
  )
}

// Reminders to customers: on/off and up to 4 times before the appointment
export function RemindersEditor({ settings, setSettings }) {
  const enabled = settings.reminders_enabled !== false
  const offsets = settings.reminder_offsets?.length ? settings.reminder_offsets : [settings.reminder_hours || 24]
  const set = (list) => setSettings(s => ({ ...s, reminder_offsets: list }))
  return (
    <div className="border rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Reminders for customers</p>
          <p className="text-xs text-muted-foreground">A WhatsApp reminder before each appointment. Add more than one, like 24 hours and 2 hours before.</p>
        </div>
        <button type="button" onClick={() => setSettings(s => ({ ...s, reminders_enabled: s.reminders_enabled === false }))}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {enabled && (
        <div className="space-y-2">
          {offsets.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="number" min="1" max="168" step="1" className="w-24 border rounded-lg px-3 py-2 text-sm bg-white" value={h ?? ''}
                onChange={e => set(offsets.map((o, j) => (j === i ? Math.min(168, Math.max(1, parseInt(e.target.value) || 1)) : o)))}
                onWheel={e => e.currentTarget.blur()} />
              <span className="text-xs text-muted-foreground">hours before</span>
              {offsets.length > 1 && (
                <button type="button" title="Remove" onClick={() => set(offsets.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><X size={14} /></button>
              )}
            </div>
          ))}
          {offsets.length < 4 && (
            <button type="button" onClick={() => set([...offsets, offsets.includes(2) ? 1 : 2])}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"><Plus size={12} /> Add another reminder</button>
          )}
          <p className="text-xs text-muted-foreground">Reminders are checked every hour. A booking made inside a reminder's window gets one reminder.</p>
        </div>
      )}
    </div>
  )
}

// Short link name: /book/<name>
export function BookingLinkCard({ settings, setSettings, projectId }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const slug = settings.booking_slug || ''
  return (
    <div className="border rounded-xl p-4 bg-white space-y-2">
      <div>
        <p className="text-sm font-semibold">Booking link name</p>
        <p className="text-xs text-muted-foreground">A short, easy link to share or print. Your earlier links keep working.</p>
      </div>
      <div className="flex items-center border rounded-lg overflow-hidden text-sm">
        <span className="px-3 py-2 bg-gray-50 text-gray-500 text-xs border-r whitespace-nowrap">{origin.replace(/^https?:\/\//, '')}/book/</span>
        <input className="flex-1 min-w-0 px-3 py-2 outline-none" placeholder="clinic" maxLength={40} value={slug}
          onChange={e => setSettings(s => ({ ...s, booking_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
      </div>
      <p className="text-xs text-muted-foreground">3 to 40 letters, numbers or dashes. Empty = the long link. Saved with Save Settings.</p>
      {slug && <p className="text-xs text-indigo-600 font-mono break-all">{origin}/book/{slug}</p>}
    </div>
  )
}

// Optional thank-you message after the appointment
export function FollowupCard({ settings, setSettings }) {
  const enabled = !!settings.followup_enabled
  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }))
  return (
    <div className="border rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Follow-up after the appointment</p>
          <p className="text-xs text-muted-foreground">A WhatsApp thank-you some hours later, for example with a review link. Not sent for cancelled or no-show bookings.</p>
        </div>
        <button type="button" onClick={() => set('followup_enabled', !enabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {enabled && (
        <div className="space-y-3">
          <NumberField label="Send it this many hours after the appointment ends" min={1} max={72} fallback={2}
            value={settings.followup_hours ?? 2} onChange={v => set('followup_hours', v)} />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Your message</label>
            <textarea className={inputCls + ' resize-none'} rows={2} maxLength={200} placeholder="e.g. Tell us how it went: https://g.page/r/your-review-link"
              value={settings.followup_message || ''} onChange={e => set('followup_message', e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Add <strong>Appointment Follow-up</strong> in <a href="templates" className="underline font-medium">Templates → Template library</a> so it reaches customers after 24 hours. Checked every hour.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
