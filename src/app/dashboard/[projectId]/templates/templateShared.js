'use client'
// Shared by the Templates page, the Create template form and Campaigns:
// language names, variable detection and a WhatsApp-style preview.
import { Reply, ExternalLink, Phone, Image as ImageIcon } from 'lucide-react'

// Same list as backend/wa_templates.py LANGUAGES.
export const LANGUAGES = {
  en_US: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada',
  ml: 'Malayalam', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati',
}
export const languageName = (code) => LANGUAGES[code] || (code === 'en' ? 'English' : code)

const VAR_RE = /\{\{\s*(\d+)\s*\}\}/g

/** Distinct variable numbers used in a text, sorted: "Hi {{2}} {{1}}" -> [1, 2]. */
export function varNumbers(text) {
  const out = new Set()
  for (const m of String(text || '').matchAll(VAR_RE)) out.add(Number(m[1]))
  return [...out].sort((a, b) => a - b)
}

/** Replace {{n}} with example values (or leave a visible placeholder). */
export function fillVars(text, values = []) {
  return String(text || '').replace(VAR_RE, (_, n) => {
    const v = values[Number(n) - 1]
    return v && String(v).trim() ? String(v) : `{{${n}}}`
  })
}

// *bold*, _italic_, ~strike~ as WhatsApp shows them.
function Formatted({ text }) {
  const parts = String(text || '').split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g)
  return parts.map((p, i) => {
    if (/^\*[^*\n]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>
    if (/^_[^_\n]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>
    if (/^~[^~\n]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>
    return <span key={i}>{p}</span>
  })
}

/**
 * header: { type: 'none'|'text'|'image', text, imageUrl }
 * buttons: [{ type: 'quick_reply'|'url'|'phone', text }]
 */
export function TemplatePreview({ header, body, footer, buttons = [], compact = false }) {
  const hasHeader = header && header.type && header.type !== 'none'
  return (
    <div className={`rounded-xl ${compact ? 'p-2' : 'p-4'}`} style={{ background: '#efeae2' }}>
      <div className="max-w-[300px]">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ borderTopLeftRadius: 2 }}>
          {hasHeader && header.type === 'image' && (
            header.imageUrl
              ? <img src={header.imageUrl} alt="" className="w-full max-h-44 object-cover block" />
              : <div className="h-28 bg-gray-100 flex items-center justify-center text-gray-400"><ImageIcon size={28} /></div>
          )}
          <div className="px-2.5 pt-2 pb-1.5 text-[13px] leading-snug text-gray-900 whitespace-pre-wrap break-words">
            {hasHeader && header.type === 'text' && header.text && (
              <p className="font-bold mb-1"><Formatted text={header.text} /></p>
            )}
            {body ? <Formatted text={body} /> : <span className="text-gray-400">Your message appears here</span>}
            {footer && <p className="text-[11px] text-gray-500 mt-1">{footer}</p>}
            <p className="text-[10px] text-gray-400 text-right mt-0.5">12:00</p>
          </div>
        </div>
        {buttons.filter(b => b.text).map((b, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm mt-1 py-1.5 text-center text-[13px] font-medium flex items-center justify-center gap-1.5" style={{ color: '#027eb5' }}>
            {b.type === 'url' ? <ExternalLink size={13} /> : b.type === 'phone' ? <Phone size={13} /> : <Reply size={13} />}
            {b.text}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Turn a template as WhatsApp returns it into TemplatePreview props. */
export function previewFromMeta(t) {
  const comps = t?.components || []
  const h = comps.find(c => c.type === 'HEADER')
  const body = comps.find(c => c.type === 'BODY')
  const footer = comps.find(c => c.type === 'FOOTER')
  const btns = comps.find(c => c.type === 'BUTTONS')
  const header = !h ? { type: 'none' }
    : h.format === 'TEXT' ? { type: 'text', text: h.text }
    : h.format === 'IMAGE' ? { type: 'image', imageUrl: h.example?.header_handle?.[0] || null }
    : { type: 'text', text: `[${String(h.format || '').toLowerCase()}]` }
  return {
    header,
    body: body?.text || '',
    footer: footer?.text || '',
    buttons: (btns?.buttons || []).map(b => ({
      type: b.type === 'URL' ? 'url' : b.type === 'PHONE_NUMBER' ? 'phone' : 'quick_reply',
      text: b.text,
    })),
  }
}
