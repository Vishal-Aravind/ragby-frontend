'use client'
import { useState, useRef } from 'react'
import {
  Image as ImageIcon, Type, Clock, Users, HelpCircle, Grid, Minus,
  Video, MapPin, Code2, Plus, Trash2, ChevronUp, ChevronDown,
  Settings, X, Eye, Save, Loader2, GripVertical
} from 'lucide-react'

// ─────────────────────────────────────────────────────────
// BLOCK DEFINITIONS
// ─────────────────────────────────────────────────────────
const BLOCK_TYPES = [
  { type: 'hero', label: 'Banner / Hero', icon: ImageIcon, desc: 'Image + title + subtitle' },
  { type: 'text', label: 'Text Block', icon: Type, desc: 'Paragraph or heading' },
  { type: 'countdown', label: 'Countdown Timer', icon: Clock, desc: 'Days left until event' },
  { type: 'speakers', label: 'Speakers / Team', icon: Users, desc: 'Cards with photo + name + role' },
  { type: 'faq', label: 'FAQ Accordion', icon: HelpCircle, desc: 'Expandable Q&A list' },
  { type: 'gallery', label: 'Image Gallery', icon: Grid, desc: 'Grid of images' },
  { type: 'video', label: 'Video Embed', icon: Video, desc: 'YouTube/Vimeo embed' },
  { type: 'map', label: 'Location Map', icon: MapPin, desc: 'Embedded Google Map' },
  { type: 'divider', label: 'Divider', icon: Minus, desc: 'Visual separator' },
  { type: 'html', label: 'Custom HTML', icon: Code2, desc: 'Advanced — raw HTML' },
]

const DEFAULT_PROPS = {
  hero: { image_url: '', title: 'Your Event Title', subtitle: 'Event subtitle goes here', overlay: true },
  text: { heading: '', body: 'Add your text here...', align: 'left' },
  countdown: { target_date: '', label: 'Event starts in' },
  speakers: { heading: 'Speakers', items: [{ name: 'Speaker Name', role: 'Role / Title', photo_url: '' }] },
  faq: { heading: 'Frequently Asked Questions', items: [{ q: 'Question here?', a: 'Answer here.' }] },
  gallery: { images: [] },
  video: { url: '', caption: '' },
  map: { embed_url: '', address: '' },
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

const TEMPLATES = {
  conference: {
    label: 'Conference / Expo',
    desc: 'Big multi-speaker event — banner, countdown, about section, speaker grid, FAQ',
    blocks: [
      { id: 'b1', type: 'hero', props: { ...DEFAULT_PROPS.hero, title: 'Your Conference Name 2026', subtitle: 'Join industry leaders for a day of insights' } },
      { id: 'b2', type: 'countdown', props: { ...DEFAULT_PROPS.countdown } },
      { id: 'b3', type: 'text', props: { heading: 'About the Event', body: 'Describe what attendees can expect...', align: 'left' } },
      { id: 'b4', type: 'speakers', props: { ...DEFAULT_PROPS.speakers } },
      { id: 'b5', type: 'faq', props: { ...DEFAULT_PROPS.faq } },
    ],
  },
  workshop: {
    label: 'Workshop / Class',
    desc: 'Hands-on session — banner, learning outcomes, photo gallery, FAQ',
    blocks: [
      { id: 'b1', type: 'hero', props: { ...DEFAULT_PROPS.hero, title: 'Workshop Title', subtitle: 'Hands-on learning session' } },
      { id: 'b2', type: 'text', props: { heading: 'What You\'ll Learn', body: 'List the key takeaways...', align: 'left' } },
      { id: 'b3', type: 'gallery', props: { images: [] } },
      { id: 'b4', type: 'faq', props: { ...DEFAULT_PROPS.faq } },
    ],
  },
  launch: {
    label: 'Product Launch',
    desc: 'Hype-building page — banner, countdown, video teaser, story',
    blocks: [
      { id: 'b1', type: 'hero', props: { ...DEFAULT_PROPS.hero, title: 'Introducing Something New', subtitle: 'Be the first to know' } },
      { id: 'b2', type: 'countdown', props: { ...DEFAULT_PROPS.countdown, label: 'Launching in' } },
      { id: 'b3', type: 'video', props: { url: '', caption: '' } },
      { id: 'b4', type: 'text', props: { heading: '', body: 'Tell your story here...', align: 'center' } },
    ],
  },
  webinar: {
    label: 'Simple Webinar',
    desc: 'Quick and minimal — banner + agenda',
    blocks: [
      { id: 'b1', type: 'hero', props: { ...DEFAULT_PROPS.hero, title: 'Webinar Title', subtitle: 'Live online session' } },
      { id: 'b2', type: 'text', props: { heading: 'Agenda', body: '1. Topic one\n2. Topic two\n3. Q&A', align: 'left' } },
    ],
  },
  blank: { label: 'Blank', desc: 'Start from scratch and add your own blocks', blocks: [] },
}

const genId = () => `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

// ─────────────────────────────────────────────────────────
// BLOCK PREVIEW (mini render inside editor canvas)
// ─────────────────────────────────────────────────────────
function BlockPreview({ block, accent }) {
  const p = block.props
  switch (block.type) {
    case 'hero':
      return (
        <div className="relative rounded-lg overflow-hidden" style={{ minHeight: 140, background: p.image_url ? `url(${p.image_url}) center/cover` : '#e5e7eb' }}>
          <div className="absolute inset-0 flex flex-col justify-end p-4" style={{ background: p.overlay ? 'linear-gradient(transparent, rgba(0,0,0,0.6))' : 'none' }}>
            <p className={`font-bold text-lg ${p.image_url ? 'text-white' : 'text-gray-700'}`}>{p.title}</p>
            <p className={`text-sm ${p.image_url ? 'text-white opacity-90' : 'text-gray-500'}`}>{p.subtitle}</p>
          </div>
        </div>
      )
    case 'text':
      return (
        <div style={{ textAlign: p.align }}>
          {p.heading && <p className="font-semibold text-sm mb-1">{p.heading}</p>}
          <p className="text-xs text-gray-500 whitespace-pre-line">{p.body}</p>
        </div>
      )
    case 'countdown':
      return (
        <div className="text-center py-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-400">{p.label}</p>
          <p className="text-lg font-bold" style={{ color: accent }}>-- days --</p>
        </div>
      )
    case 'speakers':
      return (
        <div>
          <p className="font-semibold text-sm mb-2">{p.heading}</p>
          <div className="flex gap-2 overflow-x-auto">
            {p.items.map((s, i) => (
              <div key={i} className="shrink-0 w-20 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-200 mx-auto mb-1" style={s.photo_url ? { backgroundImage: `url(${s.photo_url})`, backgroundSize: 'cover' } : {}} />
                <p className="text-xs font-medium truncate">{s.name}</p>
                <p className="text-xs text-gray-400 truncate">{s.role}</p>
              </div>
            ))}
          </div>
        </div>
      )
    case 'faq':
      return (
        <div>
          <p className="font-semibold text-sm mb-2">{p.heading}</p>
          {p.items.map((f, i) => (
            <div key={i} className="border-b py-1.5 text-xs">
              <p className="font-medium">{f.q}</p>
            </div>
          ))}
        </div>
      )
    case 'gallery':
      return (
        <div className="grid grid-cols-4 gap-1">
          {p.images.length === 0
            ? <div className="col-span-4 text-xs text-gray-400 text-center py-3 bg-gray-50 rounded">No images added</div>
            : p.images.map((img, i) => <div key={i} className="aspect-square bg-gray-200 rounded" style={{ backgroundImage: `url(${img})`, backgroundSize: 'cover' }} />)
          }
        </div>
      )
    case 'video':
      return <div className="bg-gray-100 rounded-lg p-6 text-center text-xs text-gray-400">{p.url ? '🎥 Video embedded' : 'No video URL set'}</div>
    case 'map':
      return <div className="bg-gray-100 rounded-lg p-6 text-center text-xs text-gray-400">📍 {p.address || 'No address set'}</div>
    case 'divider':
      return <hr className="border-gray-200" />
    case 'html':
      return <div className="bg-gray-50 rounded p-2 text-xs font-mono text-gray-400 truncate">{p.code}</div>
    default:
      return null
  }
}

// ─────────────────────────────────────────────────────────
// BLOCK EDITOR PANEL (right side, editing selected block)
// ─────────────────────────────────────────────────────────
function BlockEditPanel({ block, onChange, onUploadImage }) {
  const p = block.props
  const update = (patch) => onChange({ ...p, ...patch })

  const updateListItem = (key, idx, patch) => {
    const items = [...p[key]]
    items[idx] = { ...items[idx], ...patch }
    update({ [key]: items })
  }
  const addListItem = (key, empty) => update({ [key]: [...p[key], empty] })
  const removeListItem = (key, idx) => {
    const items = [...p[key]]
    items.splice(idx, 1)
    update({ [key]: items })
  }

  switch (block.type) {
    case 'hero':
      return (
        <div className="space-y-3">
          <ImageUploadField label="Banner image" value={p.image_url} onChange={url => update({ image_url: url })} onUploadImage={onUploadImage} />
          <TextField label="Title" value={p.title} onChange={v => update({ title: v })} />
          <TextField label="Subtitle" value={p.subtitle} onChange={v => update({ subtitle: v })} />
          <CheckField label="Dark overlay (for text readability)" checked={p.overlay} onChange={v => update({ overlay: v })} />
        </div>
      )
    case 'text':
      return (
        <div className="space-y-3">
          <TextField label="Heading (optional)" value={p.heading} onChange={v => update({ heading: v })} />
          <TextAreaField label="Body text" value={p.body} onChange={v => update({ body: v })} rows={5} />
          <SelectField label="Alignment" value={p.align} options={[['left', 'Left'], ['center', 'Center'], ['right', 'Right']]} onChange={v => update({ align: v })} />
        </div>
      )
    case 'countdown':
      return (
        <div className="space-y-3">
          <TextField label="Label" value={p.label} onChange={v => update({ label: v })} />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Target date</label>
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
                <div className="flex justify-end">
                  <button onClick={() => removeListItem('items', i)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
                <ImageUploadField label="Photo" value={s.photo_url} onChange={url => updateListItem('items', i, { photo_url: url })} onUploadImage={onUploadImage} compact />
                <TextField label="Name" value={s.name} onChange={v => updateListItem('items', i, { name: v })} />
                <TextField label="Role" value={s.role} onChange={v => updateListItem('items', i, { role: v })} />
              </div>
            ))}
          </div>
          <button onClick={() => addListItem('items', { name: '', role: '', photo_url: '' })}
            className="w-full text-xs border-dashed border rounded-lg py-2 text-muted-foreground hover:bg-muted">+ Add speaker</button>
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
          <div className="grid grid-cols-3 gap-2">
            {p.images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img} className="w-full aspect-square object-cover rounded" />
                <button onClick={() => removeListItem('images', i)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
              </div>
            ))}
          </div>
          <label className="block border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:bg-muted/30">
            <input type="file" accept="image/*" className="hidden" onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              const url = await onUploadImage(file)
              if (url) update({ images: [...p.images, url] })
            }} />
            <p className="text-xs text-muted-foreground">+ Add image</p>
          </label>
        </div>
      )
    case 'video':
      return (
        <div className="space-y-3">
          <TextField label="YouTube/Vimeo URL" value={p.url} onChange={v => update({ url: v })} placeholder="https://youtube.com/watch?v=..." />
          <TextField label="Caption (optional)" value={p.caption} onChange={v => update({ caption: v })} />
        </div>
      )
    case 'map':
      return (
        <div className="space-y-3">
          <TextField label="Address" value={p.address} onChange={v => update({ address: v })} />
          <TextField label="Google Maps embed URL (optional)" value={p.embed_url} onChange={v => update({ embed_url: v })} />
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
  const addField = () => onChange([...fields, { id: genId(), type: 'text', label: 'New field', required: false }])
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
      {fields.map((field, i) => (
        <div key={field.id} className="border rounded-lg p-3 space-y-2 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono">{field.id}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => moveField(i, -1)} disabled={i === 0} className="p-1 hover:bg-muted rounded disabled:opacity-30"><ChevronUp size={12} /></button>
              <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="p-1 hover:bg-muted rounded disabled:opacity-30"><ChevronDown size={12} /></button>
              {!['name', 'phone'].includes(field.id) && (
                <button onClick={() => removeField(i)} className="p-1 hover:bg-red-50 text-red-500 rounded"><Trash2 size={12} /></button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="border rounded px-2 py-1.5 text-xs" placeholder="Field label"
              value={field.label} onChange={e => updateField(i, { label: e.target.value })} />
            <select className="border rounded px-2 py-1.5 text-xs bg-white"
              value={field.type} onChange={e => updateField(i, { type: e.target.value })}
              disabled={['name', 'phone'].includes(field.id)}>
              {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
            </select>
          </div>
          {field.type === 'dropdown' && (
            <input className="w-full border rounded px-2 py-1.5 text-xs" placeholder="Options, comma separated"
              value={(field.options || []).join(', ')}
              onChange={e => updateField(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
          )}
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={field.required} onChange={e => updateField(i, { required: e.target.checked })}
              disabled={['name', 'phone'].includes(field.id)} />
            Required
          </label>
        </div>
      ))}
      <button onClick={addField} className="w-full text-xs border-dashed border rounded-lg py-2 text-muted-foreground hover:bg-muted">
        + Add field
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// SMALL FORM CONTROLS
// ─────────────────────────────────────────────────────────
function TextField({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
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
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
function ImageUploadField({ label, value, onChange, onUploadImage, compact }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {value ? (
        <div className="relative">
          <img src={value} className={compact ? "w-12 h-12 object-cover rounded" : "w-full h-24 object-cover rounded-lg border"} />
          <button onClick={() => onChange('')} className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
        </div>
      ) : (
        <label className="block border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:bg-muted/30">
          <input type="file" accept="image/*" className="hidden" onChange={async e => {
            const file = e.target.files?.[0]
            if (!file) return
            const url = await onUploadImage(file)
            if (url) onChange(url)
          }} />
          <p className="text-xs text-muted-foreground">Click to upload</p>
        </label>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// MAIN BUILDER COMPONENT
// ─────────────────────────────────────────────────────────
export default function PageBuilder({ event, onSave, onClose }) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(!event?.page_json?.length)
  const [blocks, setBlocks] = useState(event?.page_json || [])
  const [formFields, setFormFields] = useState(event?.form_schema || [
    { id: 'name', type: 'text', label: 'Your name', required: true },
    { id: 'phone', type: 'phone', label: 'WhatsApp number', required: true },
  ])
  const [selectedBlockId, setSelectedBlockId] = useState(null)
  const [rightPanel, setRightPanel] = useState('blocks') // 'blocks' | 'edit' | 'form'
  const [saving, setSaving] = useState(false)
  const dragItem = useRef(null)

  const accent = event?.accent_color || '#6366f1'

  const applyTemplate = (key) => {
    const tmpl = TEMPLATES[key]
    const blocks = tmpl.blocks.map(b => {
      const newBlock = { ...b, id: genId() }
      // Prefill the hero with what was already entered in "Create Event" —
      // avoids asking the merchant to retype the title/description/banner.
      if (b.type === 'hero' && event) {
        newBlock.props = {
          ...b.props,
          title: event.title || b.props.title,
          subtitle: event.description || b.props.subtitle,
          image_url: event.banner_url || b.props.image_url,
        }
      }
      return newBlock
    })
    setBlocks(blocks)
    setShowTemplatePicker(false)
  }

  const skipCustomPage = () => {
    // No blocks saved → public event page falls back to the simple
    // default layout built from the event's own fields.
    onClose()
  }

  const addBlock = (type) => {
    const newBlock = { id: genId(), type, props: { ...DEFAULT_PROPS[type] } }
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
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'flow-media')
      formData.append('folder', 'event-pages')
      const res = await fetch('/api/storage/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const { url } = await res.json()
        return url
      }
    } catch (e) { console.error(e) }
    return null
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({ page_json: blocks, form_schema: formFields })
    setSaving(false)
  }

  const selectedBlock = blocks.find(b => b.id === selectedBlockId)

  if (showTemplatePicker) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Design a landing page?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Optional — pick a layout to customize, or skip and use the simple default page.
              </p>
            </div>
            <button onClick={onClose}><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button key={key} onClick={() => applyTemplate(key)}
                className="border-2 rounded-xl p-4 text-left hover:border-indigo-400 transition-colors">
                <p className="font-medium text-sm">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
              </button>
            ))}
          </div>
          <button onClick={skipCustomPage}
            className="w-full text-sm border-dashed border-2 rounded-xl py-3 text-muted-foreground hover:bg-muted/30 transition-colors">
            Skip — use the simple default page instead
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-gray-800">← Close</button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold">{event?.title || 'Event Page'}</span>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Page'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
            {blocks.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No blocks yet. Add one from the right panel.
              </div>
            ) : (
              blocks.map((block, idx) => (
                <div key={block.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => { setSelectedBlockId(block.id); setRightPanel('edit') }}
                  className={`relative group p-3 cursor-pointer border-2 transition-colors ${
                    selectedBlockId === block.id ? 'border-indigo-400' : 'border-transparent hover:border-gray-200'
                  }`}>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center pr-1">
                    <GripVertical size={14} className="text-gray-300 cursor-grab" />
                  </div>
                  <BlockPreview block={block} accent={accent} />
                  {selectedBlockId === block.id && (
                    <div className="absolute top-1 right-1 flex items-center gap-1 bg-white border rounded-lg shadow-sm">
                      <button onClick={e => { e.stopPropagation(); moveBlock(idx, -1) }} className="p-1.5 hover:bg-muted"><ChevronUp size={12} /></button>
                      <button onClick={e => { e.stopPropagation(); moveBlock(idx, 1) }} className="p-1.5 hover:bg-muted"><ChevronDown size={12} /></button>
                      <button onClick={e => { e.stopPropagation(); removeBlock(block.id) }} className="p-1.5 hover:bg-red-50 text-red-500"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Form preview at bottom — always shown */}
            <div className="p-4 border-t bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 mb-2">📋 Registration Form</p>
              <div className="space-y-2">
                {formFields.map(f => (
                  <div key={f.id} className="bg-white border rounded-lg px-3 py-2 text-xs text-gray-400">
                    {f.label}{f.required ? ' *' : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 border-l flex flex-col shrink-0">
          {/* Panel tabs */}
          <div className="flex border-b shrink-0">
            <button onClick={() => setRightPanel('blocks')}
              className={`flex-1 py-2.5 text-xs font-medium ${rightPanel === 'blocks' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-muted-foreground'}`}>
              Add Blocks
            </button>
            <button onClick={() => setRightPanel('edit')} disabled={!selectedBlock}
              className={`flex-1 py-2.5 text-xs font-medium disabled:opacity-40 ${rightPanel === 'edit' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-muted-foreground'}`}>
              Edit Block
            </button>
            <button onClick={() => setRightPanel('form')}
              className={`flex-1 py-2.5 text-xs font-medium ${rightPanel === 'form' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-muted-foreground'}`}>
              Form Fields
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {rightPanel === 'blocks' && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Click to add a block to the page</p>
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

            {rightPanel === 'edit' && selectedBlock && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                  Editing: {BLOCK_TYPES.find(b => b.type === selectedBlock.type)?.label}
                </p>
                <BlockEditPanel block={selectedBlock} onChange={props => updateBlock(selectedBlock.id, props)} onUploadImage={uploadImage} />
              </div>
            )}

            {rightPanel === 'form' && (
              <div>
                <p className="text-xs text-muted-foreground mb-3">Customize what info you collect from registrants</p>
                <FormFieldsEditor fields={formFields} onChange={setFormFields} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}