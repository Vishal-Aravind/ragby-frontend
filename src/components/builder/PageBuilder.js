'use client'
import { useEffect, useState, useRef } from 'react'
import {
  Image as ImageIcon, Type, Clock, Users, HelpCircle, Grid, Minus,
  Video, MapPin, Code2, Trash2, ChevronUp, ChevronDown,
  X, Save, Loader2, ListOrdered, LayoutTemplate, ExternalLink, Check,
} from 'lucide-react'
import { uploadMedia } from '@/lib/uploadMedia'
import { confirmDialog } from '@/components/confirmDialog'
import EventBlocks, { eventInfo } from './EventBlocks'
import { EVENT_TEMPLATES, buildTemplate } from './eventTemplates'

// ─────────────────────────────────────────────────────────
// BLOCK DEFINITIONS
// ─────────────────────────────────────────────────────────
const BLOCK_TYPES = [
  { type: 'hero', label: 'Banner', icon: ImageIcon, desc: 'Big image with the event title' },
  { type: 'text', label: 'Text', icon: Type, desc: 'Heading and paragraph' },
  { type: 'agenda', label: 'Schedule', icon: ListOrdered, desc: 'Times and sessions' },
  { type: 'countdown', label: 'Countdown', icon: Clock, desc: 'Days left until the event' },
  { type: 'speakers', label: 'Speakers / Team', icon: Users, desc: 'People with photo and role' },
  { type: 'gallery', label: 'Photo gallery', icon: Grid, desc: 'Grid of photos' },
  { type: 'faq', label: 'Questions (FAQ)', icon: HelpCircle, desc: 'Questions that open on tap' },
  { type: 'video', label: 'Video', icon: Video, desc: 'YouTube or Vimeo' },
  { type: 'map', label: 'Venue / Map', icon: MapPin, desc: 'Address with directions' },
  { type: 'divider', label: 'Divider', icon: Minus, desc: 'Line or space' },
  { type: 'html', label: 'Custom HTML', icon: Code2, desc: 'Advanced' },
]
const blockLabel = (type) =>
  type === 'registration_form' ? 'Registration form' : (BLOCK_TYPES.find(b => b.type === type)?.label || type)

const DEFAULT_PROPS = {
  hero: { image_url: '', tag: '', title: 'Your Event Title', subtitle: 'A short line about the event', overlay: true },
  text: { heading: 'About the event', body: 'Describe what attendees can expect...', align: 'left' },
  agenda: { heading: 'Schedule', items: [{ time: '10:00 AM', title: 'Welcome', desc: '' }, { time: '10:30 AM', title: 'Main session', desc: '' }] },
  countdown: { target_date: '', label: 'Event starts in' },
  speakers: { heading: 'Speakers', items: [{ name: 'Speaker Name', role: 'Role / Title', photo_url: '' }] },
  faq: { heading: 'Questions', items: [{ q: 'Question here?', a: 'Answer here.' }] },
  gallery: { heading: '', images: [] },
  video: { url: '', caption: '' },
  map: { heading: 'Venue', embed_url: '', address: '' },
  divider: { style: 'line' },
  html: { code: '<p>Custom HTML content</p>' },
}

const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'phone', label: 'Phone number' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
]

const DEFAULT_FIELDS = [
  { id: 'name', type: 'text', label: 'Your name', required: true },
  { id: 'phone', type: 'phone', label: 'WhatsApp number', required: true },
]
const DEFAULT_ACCENT = '#6366f1'

const genId = () => `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

// timestamptz (UTC) <-> the "YYYY-MM-DDTHH:mm" local value a
// datetime-local input uses.
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null)

// Registration form is a singleton block — always exactly one, never
// manually added/removed (only reordered), so it gets a fixed id instead
// of a generated one.
const REGISTRATION_FORM_ID = 'registration_form'
const ensureRegistrationFormBlock = (blocksArr) => {
  if (blocksArr.some(b => b.type === 'registration_form')) return blocksArr
  const formBlock = { id: REGISTRATION_FORM_ID, type: 'registration_form', props: {} }
  const copy = [...blocksArr]
  copy.splice(Math.min(1, copy.length), 0, formBlock)
  return copy
}

// ─────────────────────────────────────────────────────────
// BLOCK EDITOR PANEL (right side, editing selected block)
// ─────────────────────────────────────────────────────────
function BlockEditPanel({ block, onChange, onUploadImage, onOpenFields }) {
  const p = block.props
  const update = (patch) => onChange({ ...p, ...patch })

  const updateListItem = (key, idx, patch) => {
    const items = [...p[key]]
    items[idx] = { ...items[idx], ...patch }
    update({ [key]: items })
  }
  const addListItem = (key, empty) => update({ [key]: [...(p[key] || []), empty] })
  const removeListItem = (key, idx) => {
    const items = [...p[key]]
    items.splice(idx, 1)
    update({ [key]: items })
  }

  switch (block.type) {
    case 'registration_form':
      return (
        <div className="space-y-3">
          <TextField label="Heading" value={p.heading} onChange={v => update({ heading: v })} placeholder="Reserve your spot" />
          <TextField label="Small line under it" value={p.subheading} onChange={v => update({ subheading: v })} placeholder="Takes 30 seconds. Confirmation comes on WhatsApp." />
          <button onClick={onOpenFields} className="w-full text-xs border rounded-lg py-2 hover:bg-muted">Edit the questions →</button>
        </div>
      )
    case 'hero':
      return (
        <div className="space-y-3">
          <ImageUploadField label="Banner image" value={p.image_url} onChange={url => update({ image_url: url })} onUploadImage={onUploadImage} />
          <TextField label="Small label (optional)" value={p.tag} onChange={v => update({ tag: v })} placeholder="e.g. Free entry" />
          <TextField label="Title" value={p.title} onChange={v => update({ title: v })} />
          <TextAreaField label="Line under the title" value={p.subtitle} onChange={v => update({ subtitle: v })} rows={2} />
          <CheckField label="Darken the image so the text is readable" checked={p.overlay !== false} onChange={v => update({ overlay: v })} />
        </div>
      )
    case 'text':
      return (
        <div className="space-y-3">
          <TextField label="Heading (optional)" value={p.heading} onChange={v => update({ heading: v })} />
          <TextAreaField label="Text" value={p.body} onChange={v => update({ body: v })} rows={7} />
          <p className="text-[11px] text-muted-foreground">Tip: start lines with ✓ for a neat checklist.</p>
          <SelectField label="Alignment" value={p.align} options={[['left', 'Left'], ['center', 'Center'], ['right', 'Right']]} onChange={v => update({ align: v })} />
        </div>
      )
    case 'agenda':
      return (
        <div className="space-y-3">
          <TextField label="Section heading" value={p.heading} onChange={v => update({ heading: v })} />
          <div className="space-y-2">
            {(p.items || []).map((it, i) => (
              <div key={i} className="border rounded-lg p-2 space-y-2">
                <div className="flex gap-2">
                  <input className="w-24 border rounded-lg px-2 py-1.5 text-sm" placeholder="10:00 AM"
                    value={it.time || ''} onChange={e => updateListItem('items', i, { time: e.target.value })} />
                  <input className="flex-1 border rounded-lg px-2 py-1.5 text-sm" placeholder="Session"
                    value={it.title || ''} onChange={e => updateListItem('items', i, { title: e.target.value })} />
                  <button onClick={() => removeListItem('items', i)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
                <input className="w-full border rounded-lg px-2 py-1.5 text-xs" placeholder="Detail (optional)"
                  value={it.desc || ''} onChange={e => updateListItem('items', i, { desc: e.target.value })} />
              </div>
            ))}
          </div>
          <button onClick={() => addListItem('items', { time: '', title: '', desc: '' })}
            className="w-full text-xs border-dashed border rounded-lg py-2 text-muted-foreground hover:bg-muted">+ Add session</button>
        </div>
      )
    case 'countdown':
      return (
        <div className="space-y-3">
          <TextField label="Label" value={p.label} onChange={v => update({ label: v })} />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Counts down to</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
              value={p.target_date} onChange={e => update({ target_date: e.target.value })} />
          </div>
        </div>
      )
    case 'speakers':
      return (
        <div className="space-y-3">
          <TextField label="Section heading" value={p.heading} onChange={v => update({ heading: v })} />
          <div className="space-y-2">
            {p.items.map((s, i) => (
              <div key={i} className="border rounded-lg p-2 space-y-2">
                <div className="flex items-start gap-2">
                  <ImageUploadField value={s.photo_url} onChange={url => updateListItem('items', i, { photo_url: url })} onUploadImage={onUploadImage} compact />
                  <div className="flex-1 space-y-1.5">
                    <input className="w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="Name"
                      value={s.name || ''} onChange={e => updateListItem('items', i, { name: e.target.value })} />
                    <input className="w-full border rounded-lg px-2 py-1.5 text-xs" placeholder="Role"
                      value={s.role || ''} onChange={e => updateListItem('items', i, { role: e.target.value })} />
                  </div>
                  <button onClick={() => removeListItem('items', i)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => addListItem('items', { name: '', role: '', photo_url: '' })}
            className="w-full text-xs border-dashed border rounded-lg py-2 text-muted-foreground hover:bg-muted">+ Add person</button>
          <p className="text-[11px] text-muted-foreground">No photo? Their initials are shown instead.</p>
        </div>
      )
    case 'faq':
      return (
        <div className="space-y-3">
          <TextField label="Section heading" value={p.heading} onChange={v => update({ heading: v })} />
          <div className="space-y-2">
            {p.items.map((f, i) => (
              <div key={i} className="border rounded-lg p-2 space-y-2">
                <div className="flex justify-end">
                  <button onClick={() => removeListItem('items', i)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
                <TextField label="Question" value={f.q} onChange={v => updateListItem('items', i, { q: v })} />
                <TextAreaField label="Answer" value={f.a} onChange={v => updateListItem('items', i, { a: v })} rows={2} />
              </div>
            ))}
          </div>
          <button onClick={() => addListItem('items', { q: '', a: '' })}
            className="w-full text-xs border-dashed border rounded-lg py-2 text-muted-foreground hover:bg-muted">+ Add question</button>
        </div>
      )
    case 'gallery':
      return (
        <div className="space-y-3">
          <TextField label="Heading (optional)" value={p.heading} onChange={v => update({ heading: v })} />
          <div className="grid grid-cols-3 gap-2">
            {(p.images || []).map((img, i) => (
              <div key={i} className="relative">
                <img src={img} alt="" className="w-full aspect-square object-cover rounded" />
                <button onClick={() => removeListItem('images', i)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
              </div>
            ))}
          </div>
          {(p.images || []).length < MAX_GALLERY ? (
            <UploadButton multiple label={`+ Add photos (${(p.images || []).length}/${MAX_GALLERY})`} onUploadImage={onUploadImage}
              max={MAX_GALLERY - (p.images || []).length}
              onUploadedMany={urls => update({ images: [...(p.images || []), ...urls].slice(0, MAX_GALLERY) })} />
          ) : (
            <p className="text-xs text-muted-foreground text-center">{MAX_GALLERY}/{MAX_GALLERY} photos - remove one to add another.</p>
          )}
        </div>
      )
    case 'video':
      return (
        <div className="space-y-3">
          <TextField label="YouTube or Vimeo link" value={p.url} onChange={v => update({ url: v })} placeholder="https://youtube.com/watch?v=..." />
          <TextField label="Caption (optional)" value={p.caption} onChange={v => update({ caption: v })} />
        </div>
      )
    case 'map':
      return (
        <div className="space-y-3">
          <TextField label="Section heading" value={p.heading} onChange={v => update({ heading: v })} />
          <TextAreaField label="Address" value={p.address} onChange={v => update({ address: v })} rows={2} />
          <p className="text-[11px] text-muted-foreground">Visitors get a Directions button that opens Google Maps.</p>
          <TextField label="Google Maps embed link (optional)" value={p.embed_url} onChange={v => update({ embed_url: v })} placeholder="https://www.google.com/maps/embed?..." />
        </div>
      )
    case 'divider':
      return (
        <div className="space-y-3">
          <SelectField label="Style" value={p.style} options={[['line', 'Line'], ['space', 'Blank space']]} onChange={v => update({ style: v })} />
        </div>
      )
    case 'html':
      return (
        <div className="space-y-3">
          <TextAreaField label="HTML code" value={p.code} onChange={v => update({ code: v })} rows={8} mono />
          <p className="text-xs text-amber-600">⚠️ Advanced — scripts are not executed for security</p>
        </div>
      )
    default:
      return null
  }
}

// ─────────────────────────────────────────────────────────
// FORM FIELD EDITOR
// ─────────────────────────────────────────────────────────
function FormFieldsEditor({ fields, onChange }) {
  const updateField = (idx, patch) => {
    const f = [...fields]
    f[idx] = { ...f[idx], ...patch }
    onChange(f)
  }
  const addField = () => onChange([...fields, { id: genId(), type: 'text', label: 'New question', required: false }])
  const removeField = (idx) => {
    const f = [...fields]
    f.splice(idx, 1)
    onChange(f)
  }
  const moveField = (idx, dir) => {
    const f = [...fields]
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= f.length) return
    ;[f[idx], f[newIdx]] = [f[newIdx], f[idx]]
    onChange(f)
  }

  return (
    <div className="space-y-2">
      {fields.map((field, i) => {
        const locked = ['name', 'phone'].includes(field.id)
        return (
          <div key={field.id} className="border rounded-lg p-3 space-y-2 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{locked ? 'Always asked' : `Question ${i + 1}`}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => moveField(i, -1)} disabled={i === 0} className="p-1 hover:bg-muted rounded disabled:opacity-30"><ChevronUp size={12} /></button>
                <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="p-1 hover:bg-muted rounded disabled:opacity-30"><ChevronDown size={12} /></button>
                {!locked && (
                  <button onClick={() => removeField(i)} className="p-1 hover:bg-red-50 text-red-500 rounded"><Trash2 size={12} /></button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="border rounded px-2 py-1.5 text-xs" placeholder="Question"
                value={field.label} onChange={e => updateField(i, { label: e.target.value })} />
              <select className="border rounded px-2 py-1.5 text-xs bg-white"
                value={field.type} onChange={e => updateField(i, { type: e.target.value })}
                disabled={locked}>
                {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
              </select>
            </div>
            {field.type === 'dropdown' && (
              <OptionsEditor options={field.options || []} onChange={options => updateField(i, { options })} />
            )}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={field.required} onChange={e => updateField(i, { required: e.target.checked })}
                disabled={locked} />
              Required
            </label>
          </div>
        )
      })}
      <button onClick={addField} className="w-full text-xs border-dashed border rounded-lg py-2 text-muted-foreground hover:bg-muted">
        + Add question
      </button>
      <p className="text-[11px] text-muted-foreground">Answers show next to each person in Registrations.</p>
    </div>
  )
}

// One box per dropdown option (a comma-separated box couldn't hold an
// option that contains a comma, and was easy to get wrong).
const MAX_OPTIONS = 20
function OptionsEditor({ options, onChange }) {
  const list = options.length ? options : ['']
  const set = (idx, v) => onChange(list.map((o, j) => (j === idx ? v : o)))
  const remove = (idx) => onChange(list.filter((_, j) => j !== idx))
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">Options</p>
      {list.map((o, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground w-4 text-right">{idx + 1}.</span>
          <input className="flex-1 border rounded px-2 py-1.5 text-xs" placeholder={`Option ${idx + 1}`}
            value={o} onChange={e => set(idx, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && list.length < MAX_OPTIONS) { e.preventDefault(); onChange([...list, '']) } }} />
          {list.length > 1 && (
            <button onClick={() => remove(idx)} className="p-1 text-red-400 hover:text-red-600" title="Remove option"><X size={12} /></button>
          )}
        </div>
      ))}
      {list.length < MAX_OPTIONS && (
        <button onClick={() => onChange([...list, ''])} className="text-xs text-indigo-600 hover:underline pl-5">+ Add option</button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// SMALL FORM CONTROLS
// ─────────────────────────────────────────────────────────
function TextField({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      {label && <label className="text-xs text-muted-foreground">{label}</label>}
      <input className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}
function TextAreaField({ label, value, onChange, rows = 3, mono }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <textarea className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200 ${mono ? 'font-mono text-xs' : ''}`}
        rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  )
}
function SelectField({ label, value, options, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}
function CheckField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
const MAX_GALLERY = 12
// Picks one or several images (up to `max`), uploads them one by one.
function UploadButton({ label, onUploadImage, onUploadedMany, multiple = false, max = 1, className = '' }) {
  const [busy, setBusy] = useState('')
  return (
    <label className={`flex items-center justify-center gap-1.5 border-2 border-dashed rounded-lg p-3 text-xs text-muted-foreground cursor-pointer hover:bg-muted/30 ${className}`}>
      <input type="file" accept="image/*" multiple={multiple} className="hidden" disabled={!!busy} onChange={async e => {
        const files = Array.from(e.target.files || []).slice(0, max)
        e.target.value = ''
        if (!files.length) return
        const urls = []
        for (let k = 0; k < files.length; k++) {
          setBusy(`Uploading ${k + 1}/${files.length}...`)
          const url = await onUploadImage(files[k])
          if (url) urls.push(url)
        }
        setBusy('')
        if (urls.length) onUploadedMany(urls)
      }} />
      {busy ? <><Loader2 size={12} className="animate-spin" /> {busy}</> : label}
    </label>
  )
}
// Shows the current image with Change / Remove, so swapping a template's
// sample photo for your own is one click.
function ImageUploadField({ label, value, onChange, onUploadImage, compact }) {
  const [busy, setBusy] = useState(false)
  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    const url = await onUploadImage(file)
    setBusy(false)
    if (url) onChange(url)
  }
  if (compact) {
    return (
      <label className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-dashed shrink-0 cursor-pointer flex items-center justify-center bg-muted/30" title="Change photo">
        <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
        {busy ? <Loader2 size={14} className="animate-spin text-muted-foreground" />
          : value ? <img src={value} alt="" className="w-full h-full object-cover" />
          : <span className="text-[10px] text-muted-foreground text-center leading-tight">Add<br />photo</span>}
      </label>
    )
  }
  return (
    <div className="space-y-1">
      {label && <label className="text-xs text-muted-foreground">{label}</label>}
      {value ? (
        <div className="relative rounded-lg overflow-hidden border">
          <img src={value} alt="" className="w-full h-28 object-cover" />
          <div className="absolute bottom-1.5 right-1.5 flex gap-1.5">
            <label className="bg-white/95 text-xs font-medium rounded-md px-2.5 py-1 shadow cursor-pointer hover:bg-white">
              <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
              {busy ? 'Uploading...' : 'Change'}
            </label>
            <button onClick={() => onChange('')} className="bg-white/95 text-xs text-red-600 rounded-md px-2.5 py-1 shadow hover:bg-white">Remove</button>
          </div>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-1.5 border-2 border-dashed rounded-lg p-4 text-xs text-muted-foreground cursor-pointer hover:bg-muted/30">
          <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
          {busy ? <><Loader2 size={12} className="animate-spin" /> Uploading...</> : 'Click to upload'}
        </label>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// TEMPLATE PICKER
// ─────────────────────────────────────────────────────────
function TemplatePicker({ onPick, onBlank, onSkip, onClose, replacing }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h3 className="font-semibold text-lg">{replacing ? 'Change template' : 'Choose a template'}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Every template comes ready to use - photos, text, schedule and questions. Just change the names, dates and images.
            </p>
            {replacing && <p className="text-xs text-amber-700 mt-1">This replaces the current page design (your event details stay).</p>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {EVENT_TEMPLATES.map(t => (
              <button key={t.key} onClick={() => onPick(t.key)}
                className="group text-left border rounded-xl overflow-hidden hover:border-indigo-400 hover:shadow-md transition">
                <div className="relative h-32 overflow-hidden">
                  <img src={`/event-templates/${t.cover}.jpg`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-2 left-3 text-white font-semibold text-sm drop-shadow">{t.label}</span>
                  <span className="absolute top-2 right-2 w-3 h-3 rounded-full ring-2 ring-white" style={{ background: t.accent }} />
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                  <p className="text-xs font-medium text-indigo-600 mt-2 opacity-0 group-hover:opacity-100 transition">Use this template →</p>
                </div>
              </button>
            ))}
            <button onClick={onBlank}
              className="border-2 border-dashed rounded-xl p-4 text-left hover:border-indigo-400 transition flex flex-col justify-center min-h-[180px]">
              <LayoutTemplate size={20} className="text-muted-foreground mb-2" />
              <p className="font-medium text-sm">Start blank</p>
              <p className="text-xs text-muted-foreground mt-1">Add your own blocks from scratch</p>
            </button>
          </div>
          {onSkip && (
            <button onClick={onSkip}
              className="w-full mt-4 text-sm text-muted-foreground hover:text-gray-800 py-2">
              Skip - use the simple default page
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// MAIN BUILDER COMPONENT
// ─────────────────────────────────────────────────────────
export default function PageBuilder({ event, onSave, onClose }) {
  const [picker, setPicker] = useState(!event?.page_json?.length ? 'new' : null) // 'new' | 'replace' | null
  const [blocks, setBlocks] = useState(() => ensureRegistrationFormBlock(event?.page_json || []))
  const [formFields, setFormFields] = useState(event?.form_schema?.length ? event.form_schema : DEFAULT_FIELDS)
  const [selectedBlockId, setSelectedBlockId] = useState(null)
  const [rightPanel, setRightPanel] = useState('details') // 'details' | 'blocks' | 'edit' | 'form'
  const [saving, setSaving] = useState(false)
  const dragItem = useRef(null)

  // Event detail fields — used to live in the "Create Event" popup, now
  // edited here so the whole thing (name → details → design) is one screen.
  const [details, setDetails] = useState({
    title: event?.title || '',
    description: event?.description || '',
    banner_url: event?.banner_url || '',
    event_date: event?.event_date || '',
    event_time: event?.event_time || '',
    location: event?.location || '',
    capacity: event?.capacity ?? '',
    contact_phone: event?.contact_phone || '',
    accent_color: event?.accent_color || DEFAULT_ACCENT,
    bot_can_register: event?.bot_can_register ?? false,
    registration_deadline: toLocalInput(event?.registration_deadline),
  })

  // Unsaved-changes guard: what was last saved (or loaded), to compare on Close.
  const snapshot = (b, f, d) => JSON.stringify({ b, f, d })
  const savedRef = useRef(null)
  if (savedRef.current === null) savedRef.current = snapshot(blocks, formFields, details)
  const dirty = snapshot(blocks, formFields, details) !== savedRef.current

  // Closing the browser tab with unsaved edits asks first too.
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const requestClose = async () => {
    if (dirty && !(await confirmDialog({
      title: 'Discard your changes?',
      description: "You have changes that aren't saved. Close without saving?",
      confirmText: 'Discard', cancelText: 'Keep editing',
    }))) return
    onClose()
  }

  const accent = details.accent_color || DEFAULT_ACCENT

  const applyTemplate = (key) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const t = buildTemplate(key, details, origin)
    if (!t) return
    setBlocks(ensureRegistrationFormBlock(t.blocks))
    // The template's questions, unless the merchant already set their own.
    const customised = formFields.some(f => !['name', 'phone'].includes(f.id))
    if (!customised) setFormFields(t.fields)
    // The template's colour and photo, unless already chosen.
    setDetails(d => ({
      ...d,
      accent_color: d.accent_color && d.accent_color !== DEFAULT_ACCENT ? d.accent_color : t.accent,
      banner_url: d.banner_url || t.cover,
    }))
    setSelectedBlockId(null)
    setRightPanel('details')
    setPicker(null)
  }

  const startBlank = () => {
    setBlocks(ensureRegistrationFormBlock([{ id: genId(), type: 'hero', props: { ...DEFAULT_PROPS.hero, title: details.title || DEFAULT_PROPS.hero.title } }]))
    setPicker(null)
  }

  const addBlock = (type) => {
    const newBlock = { id: genId(), type, props: JSON.parse(JSON.stringify(DEFAULT_PROPS[type])) }
    setBlocks([...blocks, newBlock])
    setSelectedBlockId(newBlock.id)
    setRightPanel('edit')
  }

  const updateBlock = (id, props) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, props } : b))
  }

  const removeBlock = (id) => {
    setBlocks(blocks.filter(b => b.id !== id))
    if (selectedBlockId === id) { setSelectedBlockId(null); setRightPanel('blocks') }
  }

  const moveBlock = (idx, dir) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= blocks.length) return
    const b = [...blocks]
    ;[b[idx], b[newIdx]] = [b[newIdx], b[idx]]
    setBlocks(b)
  }

  const handleDragStart = (idx) => { dragItem.current = idx }
  const handleDragOver = (e, idx) => {
    e.preventDefault()
    if (dragItem.current === null || dragItem.current === idx) return
    const b = [...blocks]
    const [moved] = b.splice(dragItem.current, 1)
    b.splice(idx, 0, moved)
    dragItem.current = idx
    setBlocks(b)
  }
  const handleDragEnd = () => { dragItem.current = null }

  const uploadImage = async (file) => {
    const { url, error } = await uploadMedia(file, 'event-pages')
    if (error) { alert(error); return null }
    return url || null
  }

  const updateDetail = (patch) => setDetails(d => ({ ...d, ...patch }))

  const handleSave = async () => {
    setSaving(true)
    const ok = await onSave({
      page_json: blocks,
      form_schema: formFields.map(f => (f.type === 'dropdown'
        ? { ...f, options: (f.options || []).map(o => String(o).trim()).filter(Boolean) }
        : f)),
      title: details.title.trim(),
      description: details.description.trim() || null,
      banner_url: details.banner_url || null,
      event_date: details.event_date || null,
      event_time: details.event_time.trim() || null,
      location: details.location.trim() || null,
      capacity: details.capacity ? parseInt(details.capacity) : null,
      contact_phone: details.contact_phone.trim() || null,
      accent_color: details.accent_color,
      bot_can_register: details.bot_can_register,
      registration_deadline: fromLocalInput(details.registration_deadline),
    })
    // Only a successful save counts as saved (a failed one keeps the
    // builder open and the edits still unsaved).
    if (ok !== false) savedRef.current = snapshot(blocks, formFields, details)
    setSaving(false)
  }

  const selectedBlock = blocks.find(b => b.id === selectedBlockId)
  const selectBlock = (block) => {
    setSelectedBlockId(block.id)
    setRightPanel(block.type === 'registration_form' ? 'edit' : 'edit')
  }

  if (picker === 'new') {
    return <TemplatePicker onPick={applyTemplate} onBlank={startBlank} onSkip={onClose} onClose={onClose} />
  }

  const tabs = [['details', 'Details'], ['blocks', 'Add block'], ['edit', 'Edit'], ['form', 'Questions']]

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={requestClose} className="text-sm text-muted-foreground hover:text-gray-800 shrink-0">← Close</button>
          {dirty && <span className="text-[11px] text-amber-600 shrink-0">Unsaved changes</span>}
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold truncate">{details.title || 'Event page'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setPicker('replace')}
            className="hidden sm:flex items-center gap-1.5 text-sm border rounded-lg px-3 py-2 hover:bg-muted">
            <LayoutTemplate size={14} /> Change template
          </button>
          {event?.id && (
            <a href={`/event/${event.id}`} target="_blank" rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-sm border rounded-lg px-3 py-2 hover:bg-muted"
              title="Opens the saved version">
              <ExternalLink size={14} /> View live page
            </a>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save page'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas: the real page, exactly as visitors see it */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6" onClick={() => setSelectedBlockId(null)}>
          <p className="text-center text-xs text-muted-foreground mb-3">Click any part of the page to edit it · drag to reorder</p>
          <div className="max-w-[420px] mx-auto bg-white rounded-[28px] shadow-xl overflow-hidden border-8 border-gray-900/90">
            {blocks.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No blocks yet. Add one from the right panel.
              </div>
            ) : (
              <EventBlocks
                blocks={blocks}
                accent={accent}
                formFields={formFields}
                info={eventInfo({ ...details, spots_left: null })}
                preview
                wrap={(block, node) => {
                  const idx = blocks.findIndex(b => b.id === block.id)
                  const isForm = block.type === 'registration_form'
                  const selected = selectedBlockId === block.id
                  return (
                    <div
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onClick={e => { e.stopPropagation(); selectBlock(block) }}
                      className={`relative group cursor-pointer outline-2 -outline-offset-2 ${selected ? 'outline outline-indigo-500' : 'hover:outline hover:outline-indigo-300'}`}>
                      <span className={`absolute top-2 left-2 z-10 text-[10px] font-semibold uppercase tracking-wide bg-indigo-600 text-white px-2 py-0.5 rounded ${selected ? '' : 'hidden group-hover:block'}`}>
                        {blockLabel(block.type)}
                      </span>
                      {node}
                      {selected && (
                        <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-white border rounded-lg shadow">
                          <button onClick={e => { e.stopPropagation(); moveBlock(idx, -1) }} className="p-1.5 hover:bg-muted" title="Move up"><ChevronUp size={13} /></button>
                          <button onClick={e => { e.stopPropagation(); moveBlock(idx, 1) }} className="p-1.5 hover:bg-muted" title="Move down"><ChevronDown size={13} /></button>
                          {!isForm && (
                            <button onClick={e => { e.stopPropagation(); removeBlock(block.id) }} className="p-1.5 hover:bg-red-50 text-red-500" title="Delete"><Trash2 size={13} /></button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                }}
              />
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 border-l flex flex-col shrink-0">
          <div className="flex border-b shrink-0">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setRightPanel(k)} disabled={k === 'edit' && !selectedBlock}
                className={`flex-1 py-2.5 text-xs font-medium disabled:opacity-40 ${rightPanel === k ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-muted-foreground'}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {rightPanel === 'details' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground mb-1">Shown on the registration page and in WhatsApp confirmations</p>
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  To send WhatsApp confirmations to people who register from the website link, add the
                  {' '}<a href="templates" className="underline font-medium">Event Registration Confirmed</a> template
                  (Templates → Template library). Without it, only people who came from a WhatsApp chat get the confirmation.
                </p>
                <TextField label="Event title" value={details.title} onChange={v => updateDetail({ title: v })} />
                <TextAreaField label="Short description" value={details.description} onChange={v => updateDetail({ description: v })} rows={3} />
                <ImageUploadField label="Cover image (event list & WhatsApp)" value={details.banner_url}
                  onChange={url => updateDetail({ banner_url: url })} onUploadImage={uploadImage} />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Date</label>
                    <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={details.event_date} onChange={e => updateDetail({ event_date: e.target.value })} />
                  </div>
                  <TextField label="Time" value={details.event_time} onChange={v => updateDetail({ event_time: v })} placeholder="10 AM - 4 PM" />
                </div>
                <TextField label="Location" value={details.location} onChange={v => updateDetail({ location: v })} placeholder="Chennai Trade Centre" />
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Registration closes on (optional)</label>
                  <div className="flex gap-1.5">
                    <input type="datetime-local" className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      value={details.registration_deadline} onChange={e => updateDetail({ registration_deadline: e.target.value })} />
                    {details.registration_deadline && (
                      <button onClick={() => updateDetail({ registration_deadline: '' })} className="text-xs border rounded-lg px-2 hover:bg-muted">Clear</button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">After this, the page shows "Registration is closed". Leave empty to keep it open.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="Seats (optional)" value={details.capacity} onChange={v => updateDetail({ capacity: v })} placeholder="Unlimited" />
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Theme colour</label>
                    <input type="color" className="w-full h-9 border rounded-lg cursor-pointer"
                      value={details.accent_color} onChange={e => updateDetail({ accent_color: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {['#4f46e5', '#0d9488', '#2563eb', '#db2777', '#b45309', '#059669', '#7c3aed', '#dc2626', '#111827'].map(c => (
                    <button key={c} onClick={() => updateDetail({ accent_color: c })} title={c}
                      className="w-6 h-6 rounded-full ring-offset-1 flex items-center justify-center"
                      style={{ background: c, boxShadow: details.accent_color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none' }}>
                      {details.accent_color === c && <Check size={12} className="text-white" />}
                    </button>
                  ))}
                </div>
                <TextField label={'Contact phone (for "Call to attend")'} value={details.contact_phone} onChange={v => updateDetail({ contact_phone: v })} placeholder="+91 98765 43210" />

                {/* Let the AI bot register directly in chat for THIS event —
                    per-event, not project-wide, since a merchant may want
                    automation on one event but not another running the same week. */}
                <div className="flex items-center justify-between border rounded-xl px-3 py-3 bg-white">
                  <div>
                    <p className="text-sm font-medium">Let the AI register in chat</p>
                    <p className="text-xs text-muted-foreground">Your chatbot can register customers for this event directly inside a conversation (WhatsApp, Telegram, web chat)</p>
                  </div>
                  <button
                    onClick={() => updateDetail({ bot_can_register: !details.bot_can_register })}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors shrink-0 ml-4 ${details.bot_can_register ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${details.bot_can_register ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}

            {rightPanel === 'blocks' && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Click to add a block at the end of the page</p>
                {BLOCK_TYPES.map(bt => {
                  const Icon = bt.icon
                  return (
                    <button key={bt.type} onClick={() => addBlock(bt.type)}
                      className="w-full flex items-start gap-3 border rounded-lg p-3 hover:border-indigo-300 hover:bg-indigo-50/30 text-left transition-colors">
                      <Icon size={16} className="text-indigo-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{bt.label}</p>
                        <p className="text-xs text-muted-foreground">{bt.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {rightPanel === 'edit' && (
              selectedBlock ? (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                    {blockLabel(selectedBlock.type)}
                  </p>
                  <BlockEditPanel block={selectedBlock} onChange={props => updateBlock(selectedBlock.id, props)}
                    onUploadImage={uploadImage} onOpenFields={() => setRightPanel('form')} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Click a part of the page to edit it.</p>
              )
            )}

            {rightPanel === 'form' && (
              <div>
                <p className="text-xs text-muted-foreground mb-3">What you ask people when they register</p>
                <FormFieldsEditor fields={formFields} onChange={setFormFields} />
              </div>
            )}
          </div>
        </div>
      </div>

      {picker === 'replace' && (
        <TemplatePicker
          replacing
          onPick={applyTemplate}
          onBlank={() => { startBlank(); setPicker(null) }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
