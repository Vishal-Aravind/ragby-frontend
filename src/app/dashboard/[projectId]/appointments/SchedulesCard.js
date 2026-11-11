'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { WorkingHoursEditor, DateOverridesEditor } from './AvailabilityEditor'
import { confirmDialog } from '@/components/confirmDialog'

// Named schedules ("Clinic hours", "Evening hours"): weekly hours plus
// date-specific hours. Each service picks one in its own form.
export default function SchedulesCard({ projectId, schedules, onChanged }) {
  const [openId, setOpenId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  const open = schedules.find(s => s.id === openId)
  useEffect(() => {
    setDraft(open ? { name: open.name, working_hours: open.working_hours || {}, date_overrides: open.date_overrides || [] } : null)
  }, [openId, schedules])

  const call = async (url, method, body) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : data.error || 'Something went wrong')
    return data
  }

  const run = async (fn) => {
    setSaving(true)
    try { await fn() } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const add = () => run(async () => {
    const created = await call('/api/appointment-schedules', 'POST', { project_id: projectId, name: `Schedule ${schedules.length + 1}` })
    await onChanged()
    setOpenId(created.id)
  })

  const save = () => run(async () => {
    await call(`/api/appointment-schedules/${openId}`, 'PUT', draft)
    await onChanged()
  })

  const makeDefault = (id) => run(async () => {
    await call(`/api/appointment-schedules/${id}`, 'PUT', { is_default: true })
    await onChanged()
  })

  const remove = async (s) => {
    if (!(await confirmDialog({ title: `Delete "${s.name}"?`, description: 'Services using it switch to the default schedule.' }))) return
    run(async () => {
      await call(`/api/appointment-schedules/${s.id}`, 'DELETE')
      setOpenId(null)
      await onChanged()
    })
  }

  return (
    <div className="border rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Schedules</p>
          <p className="text-xs text-muted-foreground">
            When you're available. Make one for each set of hours, then pick it on a service. Services without a pick use the default.
          </p>
        </div>
        <button onClick={add} disabled={saving}
          className="flex items-center gap-1 text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
          <Plus size={12} /> New schedule
        </button>
      </div>

      <div className="space-y-2">
        {schedules.map(s => (
          <div key={s.id} className={`border rounded-lg ${openId === s.id ? 'border-indigo-300' : ''}`}>
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <button onClick={() => setOpenId(openId === s.id ? null : s.id)} className="flex-1 text-left text-sm font-medium flex items-center gap-2 min-w-0">
                <span className="truncate">{s.name}</span>
                {s.is_default && <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full shrink-0">Default</span>}
              </button>
              <div className="flex items-center gap-3 shrink-0">
                {!s.is_default && (
                  <button onClick={() => makeDefault(s.id)} disabled={saving} className="text-xs text-gray-500 hover:underline">Make default</button>
                )}
                {!s.is_default && (
                  <button onClick={() => remove(s)} title="Delete" className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                )}
                <button onClick={() => setOpenId(openId === s.id ? null : s.id)} className="text-xs text-indigo-600 hover:underline">
                  {openId === s.id ? 'Close' : 'Edit'}
                </button>
              </div>
            </div>

            {openId === s.id && draft && (
              <div className="border-t p-3 space-y-4">
                <input value={draft.name} maxLength={80} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Schedule name" />
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Weekly hours</p>
                  <WorkingHoursEditor value={draft.working_hours} onChange={wh => setDraft(d => ({ ...d, working_hours: wh }))} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Date-specific hours</p>
                  <DateOverridesEditor value={draft.date_overrides} onChange={list => setDraft(d => ({ ...d, date_overrides: list }))} />
                </div>
                <button onClick={save} disabled={saving || !draft.name.trim()}
                  className="flex items-center gap-1 text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
                  <Check size={12} /> {saving ? 'Saving...' : 'Save schedule'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
