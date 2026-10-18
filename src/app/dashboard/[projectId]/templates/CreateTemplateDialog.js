'use client'
// Create a WhatsApp template inside Zavo: header (none / text / image),
// message with variables, footer, buttons - with a live preview. The rules
// WhatsApp applies are checked on the server (backend/wa_templates.py) and
// any problem comes back as a plain sentence shown above the Submit button.
import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X, Loader2, Upload, Info } from 'lucide-react'
import { uploadMedia } from '@/lib/uploadMedia'
import { LANGUAGES, varNumbers, fillVars, TemplatePreview } from './templateShared'

const EMPTY = {
  name: '', category: 'MARKETING', language: 'en_US',
  headerType: 'none', headerText: '', headerExample: '', headerImageUrl: '',
  body: '', examples: [], footer: '', buttons: [],
}
const BUTTON_TYPES = { quick_reply: 'Quick reply', url: 'Visit website', phone: 'Call number' }

const toName = (v) => v.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+/, '').slice(0, 512)

const VAR_ANY = /\{\{\s*\d+\s*\}\}/
// Meta counts "{{1}}." as a variable at the end, so punctuation next to the
// first/last variable doesn't make it acceptable - only words do.
const LEADING_VAR = /^[\s.,;:!?'"(\[\-\u2013\u2014\u2026]*\{\{\s*\d+\s*\}\}/
const TRAILING_VAR = /\{\{\s*\d+\s*\}\}[\s.,;:!?'")\]\-\u2013\u2014\u2026]*$/
const PHONE_RE = /^\+[1-9]\d{6,14}$/
const isEmptyButton = (b) => !(b.text || '').trim() && !(b.url || '').trim() && !(b.phone || '').trim()

// Same rules as backend/wa_templates.py build_components, checked as you
// type. `required` problems (empty fields) are kept apart so a fresh form
// isn't covered in red before the first Submit.
function validate(f, existingNames) {
  const live = {}      // shown immediately
  const required = {}  // shown after Submit is pressed
  if (!f.name) required.name = 'Give the template a name.'
  else if (existingNames.includes(`${f.name}|${f.language}`)) live.name = 'A template with this name already exists in this language.'

  if (f.headerType === 'text') {
    const t = f.headerText.trim()
    const n = varNumbers(t)
    if (!t) required.header = 'Type the header text, or choose None.'
    else if (t.length > 60) live.header = 'At most 60 characters.'
    else if (n.length > 1 || (n.length === 1 && n[0] !== 1) || (t.match(/\{\{/g) || []).length > 1) live.header = 'Only one variable, {{1}}, is allowed in the header.'
    if (n.length && !f.headerExample.trim()) required.headerExample = 'Add an example value for {{1}}.'
  } else if (f.headerType === 'image' && !f.headerImageUrl) {
    required.header = 'Upload an image (JPG or PNG).'
  }

  const body = f.body.trim()
  const nums = varNumbers(body)
  if (!body) required.body = 'Type the message.'
  else if (body.length > 1024) live.body = 'At most 1024 characters.'
  else if (nums.length && nums.join(',') !== nums.map((_, i) => i + 1).join(',')) live.body = 'Number the variables {{1}}, {{2}}, ... in order, without gaps.'
  else if (LEADING_VAR.test(body.trim())) live.body = "Can't start with a variable - put a few words before it."
  else if (TRAILING_VAR.test(body.trim())) live.body = "Can't end with a variable - a full stop after it doesn't help, add a few words after it."
  else if (/\}\}\s*\{\{/.test(body)) live.body = "Two variables can't be right next to each other - put a word between them."
  const examples = {}
  nums.forEach((n, i) => { if (!(f.examples[i] || '').trim()) examples[i] = 'Add an example value.' })
  if (Object.keys(examples).length) required.examples = examples

  if (f.footer.trim().length > 60) live.footer = 'At most 60 characters.'
  else if (VAR_ANY.test(f.footer)) live.footer = "Variables aren't allowed in the footer."

  const buttons = {}
  const buttonsRequired = {}
  f.buttons.forEach((b, i) => {
    if (isEmptyButton(b)) return
    const text = (b.text || '').trim()
    if (!text) buttonsRequired[i] = 'Type the button text.'
    else if (text.length > 25) buttons[i] = 'At most 25 characters.'
    if (b.type === 'url') {
      const u = (b.url || '').trim()
      if (!u) buttonsRequired[i] = 'Enter the link.'
      else if (!/^https?:\/\//i.test(u)) buttons[i] = 'Enter a full link starting with https://'
      else if (u.includes('{{')) buttons[i] = "Links with variables aren't supported - use a fixed link."
    }
    if (b.type === 'phone') {
      const ph = (b.phone || '').replace(/[\s-]/g, '')
      if (!ph) buttonsRequired[i] = 'Enter the phone number.'
      else if (!PHONE_RE.test(ph)) buttons[i] = 'Add the country code, e.g. +919876543210.'
    }
  })
  if (Object.keys(buttons).length) live.buttons = buttons
  if (Object.keys(buttonsRequired).length) required.buttons = buttonsRequired
  return { live, required }
}

const FieldError = ({ msg }) => (msg ? <p className="text-[11px] text-red-600 mt-1">{msg}</p> : null)

export default function CreateTemplateDialog({ open, onOpenChange, projectId, existingNames = [], onCreated }) {
  const [f, setF] = useState(EMPTY)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)   // Submit pressed: also show "missing" problems
  const bodyRef = useRef(null)
  const set = (patch) => setF(prev => ({ ...prev, ...patch }))

  const bodyVars = varNumbers(f.body)
  const headerHasVar = varNumbers(f.headerText).length > 0
  const urlCount = f.buttons.filter(b => b.type === 'url').length
  const phoneCount = f.buttons.filter(b => b.type === 'phone').length
  const { live, required } = validate(f, existingNames)
  // What each field shows: format problems always, missing parts after Submit.
  const err = (key) => live[key] || (tried ? required[key] : undefined)
  const buttonErr = (i) => (live.buttons || {})[i] || (tried ? (required.buttons || {})[i] : undefined)
  const exampleErr = (i) => (tried ? (required.examples || {})[i] : undefined)
  const hasProblems = Object.keys(live).length > 0 || Object.keys(required).length > 0

  const reset = () => { setF(EMPTY); setError(''); setTried(false) }
  const close = (v) => { if (!v) reset(); onOpenChange(v) }

  const addBodyVar = () => {
    const next = (bodyVars.length ? Math.max(...bodyVars) : 0) + 1
    const el = bodyRef.current
    const token = `{{${next}}}`
    if (el && typeof el.selectionStart === 'number') {
      const s = el.selectionStart, e = el.selectionEnd
      const body = f.body.slice(0, s) + token + f.body.slice(e)
      set({ body })
      requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + token.length })
    } else {
      set({ body: f.body + token })
    }
  }

  const setExample = (i, v) => {
    const examples = [...f.examples]
    examples[i] = v
    set({ examples })
  }

  const onImage = async (file) => {
    if (!file) return
    if (!/\.(jpe?g|png)$/i.test(file.name)) { setError('Header image: use a JPG or PNG.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Header image: 5MB at most.'); return }
    setError('')
    setUploading(true)
    const { url, error: upErr } = await uploadMedia(file, 'wa-template')
    setUploading(false)
    if (upErr) { setError(upErr); return }
    set({ headerImageUrl: url })
  }

  const addButton = (type) => set({ buttons: [...f.buttons, { type, text: '', url: '', phone: '' }] })
  const updButton = (i, patch) => set({ buttons: f.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)) })
  const delButton = (i) => set({ buttons: f.buttons.filter((_, j) => j !== i) })

  const submit = async () => {
    setError('')
    setTried(true)
    if (hasProblems) { setError('Fix the fields marked in red, then submit again.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          name: f.name,
          category: f.category,
          language: f.language,
          header_type: f.headerType,
          header_text: f.headerType === 'text' ? f.headerText : null,
          header_example: f.headerType === 'text' && headerHasVar ? f.headerExample : null,
          header_image_url: f.headerType === 'image' ? f.headerImageUrl : null,
          body: f.body,
          body_examples: bodyVars.map((_, i) => f.examples[i] || ''),
          footer: f.footer || null,
          // A button card left completely empty is ignored, not an error.
          buttons: f.buttons
            .filter(b => (b.text || '').trim() || (b.url || '').trim() || (b.phone || '').trim())
            .map(b => ({ type: b.type, text: b.text, url: b.type === 'url' ? b.url : null, phone: b.type === 'phone' ? b.phone : null })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.detail === 'string' ? data.detail : data.error || "Couldn't submit this template. Please try again.")
        return
      }
      onCreated?.({ name: f.name, language: f.language, status: data.status || 'PENDING' })
      close(false)
    } catch {
      setError("Couldn't reach the server. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-5xl w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Create template</DialogTitle>
          <DialogDescription>
            WhatsApp reviews every template before it can be sent - usually within minutes, sometimes a few hours.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-[minmax(0,1fr)_320px] gap-6 min-w-0">
          {/* ---------------- form ---------------- */}
          <div className="space-y-5 min-w-0">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={f.name} placeholder="e.g. diwali_offer" maxLength={512}
                onChange={e => set({ name: toName(e.target.value) })} />
              <p className="text-[11px] text-muted-foreground">Only for you - customers don&apos;t see it. Lowercase letters, numbers and _.</p>
              <FieldError msg={err('name')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={f.category} onValueChange={v => set({ category: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing - offers, announcements</SelectItem>
                    <SelectItem value="UTILITY">Utility - orders, bookings, reminders</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Language</Label>
                <Select value={f.language} onValueChange={v => set({ language: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LANGUAGES).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-3">WhatsApp may move a template to Marketing if it promotes something.</p>

            {/* Header */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Header (optional)</Label>
              <div className="flex gap-1.5">
                {[['none', 'None'], ['text', 'Text'], ['image', 'Image']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => set({ headerType: v })}
                    className={`text-xs px-3 py-1.5 rounded-full border ${f.headerType === v ? 'bg-gray-900 text-white border-gray-900' : 'hover:bg-muted'}`}>{l}</button>
                ))}
              </div>
              {f.headerType === 'text' && (
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <Input value={f.headerText} maxLength={60} placeholder="e.g. Diwali offer for {{1}}"
                      onChange={e => set({ headerText: e.target.value })} />
                    {!headerHasVar && (
                      <Button type="button" variant="outline" size="sm" onClick={() => set({ headerText: `${f.headerText} {{1}}`.trimStart() })}>+ Variable</Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{f.headerText.length}/60 · at most one variable</p>
                  <FieldError msg={err('header')} />
                  {headerHasVar && (
                    <>
                      <Input value={f.headerExample} placeholder="Example for {{1}}, e.g. Asha"
                        onChange={e => set({ headerExample: e.target.value })} />
                      <FieldError msg={err('headerExample')} />
                    </>
                  )}
                </div>
              )}
              {f.headerType === 'image' && (
                <div className="flex items-center gap-3">
                  {f.headerImageUrl && <img src={f.headerImageUrl} alt="" className="h-16 w-24 object-cover rounded border" />}
                  <label className="text-sm border rounded px-3 py-1.5 hover:bg-muted cursor-pointer inline-flex items-center gap-1.5">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {f.headerImageUrl ? 'Replace image' : 'Upload image'}
                    <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={uploading}
                      onChange={e => { onImage(e.target.files?.[0]); e.target.value = '' }} />
                  </label>
                  <span className="text-[11px] text-muted-foreground">JPG or PNG, up to 5MB. A sample - each campaign can use its own image.</span>
                </div>
              )}
              {f.headerType === 'image' && <FieldError msg={err('header')} />}
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Message</Label>
                <Button type="button" variant="outline" size="sm" onClick={addBodyVar} className="h-7 text-xs">
                  <Plus size={12} className="mr-1" /> Add variable
                </Button>
              </div>
              <Textarea ref={bodyRef} rows={5} maxLength={1024} value={f.body}
                placeholder={'e.g. Hi {{1}}, enjoy {{2}}% off everything this Diwali! Visit us before Sunday.'}
                onChange={e => set({ body: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">
                {f.body.length}/1024 · Variables ({'{{1}}'}, {'{{2}}'}...) are filled in for each campaign. *bold* _italic_ ~strike~ work.
              </p>
              <FieldError msg={err('body')} />
              {bodyVars.length > 0 && (
                <div className="space-y-1.5 bg-muted/40 rounded-lg p-2.5">
                  <p className="text-[11px] text-muted-foreground">Example values - WhatsApp uses them to review the template.</p>
                  {bodyVars.map((n, i) => (
                    <div key={n}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono w-10 shrink-0">{`{{${n}}}`}</span>
                        <Input className="h-8 text-sm" value={f.examples[i] || ''} placeholder={n === 1 ? 'e.g. Asha' : 'Example value'}
                          onChange={e => setExample(i, e.target.value)} />
                      </div>
                      <div className="pl-12"><FieldError msg={exampleErr(i)} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Footer (optional)</Label>
              <Input value={f.footer} maxLength={60} placeholder="e.g. Reply STOP to unsubscribe"
                onChange={e => set({ footer: e.target.value })} />
              <FieldError msg={err('footer')} />
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Buttons (optional)</Label>
              <p className="text-[11px] text-muted-foreground">Up to 10: at most 2 website and 1 call. With more than 3, WhatsApp shows 2 and a &quot;See all options&quot; list.</p>
              {f.buttons.map((b, i) => (
                <div key={i} className="border rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{BUTTON_TYPES[b.type]}</span>
                    <button type="button" onClick={() => delButton(i)} className="text-red-400"><X size={14} /></button>
                  </div>
                  <Input className="h-8 text-sm" maxLength={25} value={b.text} placeholder="Button text (max 25)"
                    onChange={e => updButton(i, { text: e.target.value })} />
                  {b.type === 'url' && (
                    <Input className="h-8 text-sm" value={b.url} placeholder="https://yourshop.com/offer"
                      onChange={e => updButton(i, { url: e.target.value })} />
                  )}
                  {b.type === 'phone' && (
                    <Input className="h-8 text-sm" value={b.phone} placeholder="+919876543210"
                      onChange={e => updButton(i, { phone: e.target.value })} />
                  )}
                  <FieldError msg={buttonErr(i)} />
                </div>
              ))}
              {f.buttons.length < 10 && (
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="outline" size="sm" onClick={() => addButton('quick_reply')}><Plus size={12} className="mr-1" /> Quick reply</Button>
                  {urlCount < 2 && <Button type="button" variant="outline" size="sm" onClick={() => addButton('url')}><Plus size={12} className="mr-1" /> Website</Button>}
                  {phoneCount < 1 && <Button type="button" variant="outline" size="sm" onClick={() => addButton('phone')}><Plus size={12} className="mr-1" /> Call</Button>}
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground flex items-start gap-1">
              <Info size={11} className="mt-0.5 shrink-0" />
              Need a video, document or carousel template? Create it in WhatsApp Manager - it will show up in My templates.
            </p>
          </div>

          {/* ---------------- preview ---------------- */}
          <div className="space-y-2 md:sticky md:top-0 self-start">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            <TemplatePreview
              header={{ type: f.headerType, text: fillVars(f.headerText, [f.headerExample]), imageUrl: f.headerImageUrl }}
              body={fillVars(f.body, f.examples)}
              footer={f.footer}
              buttons={f.buttons}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => close(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || uploading || !f.body.trim()}>
            {submitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
            Submit for approval
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
