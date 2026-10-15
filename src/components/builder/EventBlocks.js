"use client";

// The event page's blocks, drawn the same way on the public registration
// page (src/app/event/[eventId]/page.js) and on the builder's canvas
// (PageBuilder.js) - so what the merchant designs is exactly what visitors
// see. `wrap(block, node)` lets the builder put a selectable frame around
// each block; `preview` makes the form inert.
import { useEffect, useState } from "react";
import { Clock, Calendar, MapPin, Users } from "lucide-react";

// Origins allowed inside an <iframe> on a public registration page.
// page_json is merchant-authored, but "merchant" includes any teammate
// granted the Registrations tab, and an iframe on a page anonymous
// visitors load is a much bigger surface than a broken embed. Anything
// unrecognised renders as a plain link instead.
const ALLOWED_EMBED_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "www.google.com",       // maps embeds
  "maps.google.com",
  "www.openstreetmap.org",
];

export function safeEmbedUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    // Blocks javascript: and data: before the host check even matters.
    if (url.protocol !== "https:") return null;
    if (!ALLOWED_EMBED_HOSTS.includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Only http(s) images and our own bundled template images.
const safeImg = (u) => (typeof u === "string" && (/^https?:\/\//i.test(u) || u.startsWith("/event-templates/")) ? u : null);

const initials = (name) =>
  String(name || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

export function Countdown({ targetDate, label, accent, preview }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!targetDate) return;
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, mins: 0 }); return; }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / (1000 * 60)) % 60),
      });
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate || !timeLeft) {
    // On the builder canvas, show where the countdown will be.
    return preview ? (
      <div className="text-center py-5 px-4 rounded-2xl text-xs text-gray-400" style={{ background: `${accent}11` }}>
        {label} - set the event date in Details
      </div>
    ) : null;
  }

  return (
    <div className="text-center py-5 px-4 rounded-2xl" style={{ background: `${accent}11` }}>
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">{label}</p>
      <div className="flex items-center justify-center gap-3">
        {[["Days", timeLeft.days], ["Hours", timeLeft.hours], ["Mins", timeLeft.mins]].map(([l, v]) => (
          <div key={l} className="bg-white rounded-xl shadow-sm w-20 py-2.5">
            <p className="text-2xl font-bold tabular-nums" style={{ color: accent }}>{v}</p>
            <p className="text-[11px] text-gray-400">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Custom HTML is cleaned in the browser only. isomorphic-dompurify pulled
// jsdom into the server render, which crashes on Vercel's Node (and broke
// every page that renders these blocks). Nothing is shown until it's clean.
function HtmlBlock({ code }) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    let alive = true;
    import("dompurify").then(m => {
      if (alive) setHtml(m.default.sanitize(code || "", { USE_PROFILES: { html: true } }));
    });
    return () => { alive = false; };
  }, [code]);
  return <div className="px-5 py-2" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="text-sm font-medium text-gray-800">{q}</span>
        <span className="text-gray-400 text-lg leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-4 pb-3 text-sm text-gray-500 leading-relaxed whitespace-pre-line">{a}</div>}
    </div>
  );
}

export function DynamicForm({ fields, accent, onSubmit, submitting, preview }) {
  const [values, setValues] = useState(
    Object.fromEntries(fields.map(f => [f.id, f.type === "checkbox" ? false : ""]))
  );
  const [error, setError] = useState(null);

  const setVal = (id, v) => setValues(prev => ({ ...prev, [id]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (preview) return;
    setError(null);
    for (const f of fields) {
      // `!values[f.id]` alone treated a legitimate 0 as missing, and let a
      // string of spaces through as present.
      const raw = values[f.id];
      const empty =
        raw === undefined || raw === null || raw === false ||
        (typeof raw === "string" && !raw.trim());
      if (f.required && empty) {
        setError(`${f.label} is required`);
        return;
      }
    }

    // The backend is the authority on this (it has to be — anyone can POST
    // the endpoint directly), but catching it here saves a round trip and
    // gives a clearer message than a 400 does.
    // Phone fields are two boxes (country code + number) so the code can't
    // be forgotten - without it WhatsApp can't deliver the confirmation.
    // They're joined into one digits-only number before sending.
    const out = { ...values };
    for (const f of fields.filter(f => f.type === "phone")) {
      const cc = String(values[`${f.id}__cc`] ?? "").replace(/\D/g, "");
      const num = String(values[f.id] ?? "").replace(/\D/g, "").replace(/^0+/, "");
      delete out[`${f.id}__cc`];
      if (!num && !f.required) { delete out[f.id]; continue; }
      if (!cc || cc.length > 4) {
        setError(`Please enter the country code for ${f.label} (e.g. 91)`);
        return;
      }
      if (num.length < 6 || cc.length + num.length > 15) {
        setError(`Please enter a valid ${f.label}`);
        return;
      }
      out[f.id] = cc + num;
    }

    onSubmit(out);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
      {fields.map(f => (
        <div key={f.id} className="space-y-1">
          {f.type !== "checkbox" && <label className="text-xs font-medium text-gray-600">{f.label}{f.required && " *"}</label>}
          {f.type === "textarea" ? (
            <textarea rows={3} value={values[f.id] ?? ""} onChange={e => setVal(f.id, e.target.value)}
              className="w-full border rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 bg-white" />
          ) : f.type === "dropdown" ? (
            <select value={values[f.id] ?? ""} onChange={e => setVal(f.id, e.target.value)}
              className="w-full border rounded-xl px-3 py-3 text-sm outline-none bg-white">
              <option value="">Select...</option>
              {(f.options || []).filter(o => String(o).trim()).map((o, i) => <option key={`${i}-${o}`} value={o}>{o}</option>)}
            </select>
          ) : f.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={!!values[f.id]} onChange={e => setVal(f.id, e.target.checked)} />
              {f.label}{f.required && " *"}
            </label>
          ) : f.type === "phone" ? (
            <div className="flex gap-2">
              <div className="relative w-20 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">+</span>
                <input type="tel" inputMode="numeric" placeholder="91" maxLength={4} aria-label="Country code"
                  value={values[`${f.id}__cc`] ?? ""} onChange={e => setVal(`${f.id}__cc`, e.target.value.replace(/\D/g, ""))}
                  className="w-full border rounded-xl pl-6 pr-2 py-3 text-sm outline-none focus:ring-2 bg-white" />
              </div>
              <input type="tel" inputMode="numeric" placeholder="98765 43210" aria-label={f.label}
                value={values[f.id] ?? ""} onChange={e => setVal(f.id, e.target.value)}
                className="flex-1 min-w-0 border rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 bg-white" />
            </div>
          ) : (
            <input
              type={f.type === "email" ? "email" : f.type === "number" ? "number" : "text"}
              placeholder={f.type === "email" ? "you@example.com" : ""}
              value={values[f.id] ?? ""} onChange={e => setVal(f.id, e.target.value)}
              className="w-full border rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 bg-white" />
          )}
        </div>
      ))}
      <button type="submit" disabled={submitting || preview}
        className="w-full py-4 rounded-xl text-white font-semibold text-base disabled:opacity-90 shadow-sm"
        style={{ background: accent }}>
        {submitting ? "Registering..." : "Confirm Registration ✓"}
      </button>
    </form>
  );
}

// Date / place / seats, shown as a card right under the banner.
function InfoCard({ info, accent }) {
  const rows = [
    info?.date && [Calendar, info.date],
    info?.location && [MapPin, info.location],
    info?.seats && [Users, info.seats],
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="px-4 -mt-5 relative z-[1]">
      <div className="bg-white rounded-2xl shadow-md border p-4 space-y-2.5">
        {rows.map(([Icon, text], i) => (
          <div key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
            <Icon size={16} className="mt-0.5 shrink-0" style={{ color: accent }} /> <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EventBlocks({
  blocks, accent, formFields, onSubmit, submitting, spotsFull, registrationClosed, contactPhone,
  info = null, preview = false, wrap = (block, node) => node,
}) {
  const firstHero = (blocks || []).find(b => b.type === "hero")?.id;
  return (
    <div>
      {(blocks || []).map(block => {
        let node = renderBlock(block, { accent, formFields, onSubmit, submitting, spotsFull, registrationClosed, contactPhone, preview });
        if (node && block.id === firstHero && info) node = <>{node}<InfoCard info={info} accent={accent} /></>;
        return node ? <div key={block.id}>{wrap(block, node)}</div> : null;
      })}
    </div>
  );
}

/** "Saturday, 14 November 2026 · 10 AM - 4 PM" etc. for the info card. */
export function eventInfo({ event_date, event_time, location, capacity, spots_left }) {
  let date = "";
  if (event_date) {
    const d = new Date(`${String(event_date).slice(0, 10)}T00:00:00`);
    if (!isNaN(d)) date = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  if (date && event_time) date += ` · ${event_time}`;
  else if (!date && event_time) date = event_time;
  let seats = "";
  if (capacity) seats = spots_left == null ? `${capacity} seats` : spots_left > 0 ? `${spots_left} seats left` : "Fully booked";
  return { date, location: location || "", seats };
}

function renderBlock(block, ctx) {
  const p = block.props || {};
  const { accent, preview } = ctx;
  switch (block.type) {
    case "registration_form":
      return (
        <div className="px-4 py-5">
          {ctx.spotsFull || ctx.registrationClosed ? (
            <div className="bg-gray-50 rounded-2xl border p-6 text-center space-y-2">
              <p className="text-gray-600 font-medium text-sm">{ctx.spotsFull ? "This event is fully booked" : "Registration is closed"}</p>
              {ctx.contactPhone && <p className="text-xs text-gray-400">Call {ctx.contactPhone} for more info</p>}
            </div>
          ) : (
            <div className="rounded-2xl border p-5 shadow-sm bg-white" style={{ borderTop: `4px solid ${accent}` }}>
              <p className="font-bold text-lg text-gray-900">{p.heading || "Reserve your spot"}</p>
              <p className="text-xs text-gray-500 mb-4">{p.subheading || "Takes 30 seconds. Confirmation comes on WhatsApp."}</p>
              <DynamicForm fields={ctx.formFields} accent={accent} onSubmit={ctx.onSubmit} submitting={ctx.submitting} preview={preview} />
            </div>
          )}
        </div>
      );

    case "hero": {
      const img = safeImg(p.image_url);
      return (
        <div className="relative" style={{
          minHeight: 260,
          background: img ? `url(${img}) center/cover` : `linear-gradient(135deg, ${accent}, ${accent}aa)`,
        }}>
          <div className="flex flex-col justify-end p-6" style={{
            minHeight: 260,
            background: img && p.overlay !== false ? "linear-gradient(180deg, rgba(0,0,0,0.05) 20%, rgba(0,0,0,0.72))" : "none",
          }}>
            {p.tag && (
              <span className="self-start text-[11px] font-semibold uppercase tracking-wider text-white/95 px-2.5 py-1 rounded-full mb-3" style={{ background: accent }}>
                {p.tag}
              </span>
            )}
            <h1 className="text-white font-extrabold text-[26px] leading-tight drop-shadow-sm">{p.title}</h1>
            {p.subtitle && <p className="text-white/90 text-sm mt-2 leading-relaxed">{p.subtitle}</p>}
          </div>
        </div>
      );
    }

    case "text":
      return (
        <div className="px-5 py-5" style={{ textAlign: p.align }}>
          {p.heading && <h2 className="font-bold text-lg mb-2 text-gray-900">{p.heading}</h2>}
          <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{p.body}</p>
        </div>
      );

    case "agenda":
      return (
        <div className="px-5 py-5">
          {p.heading && <h2 className="font-bold text-lg mb-4 text-gray-900">{p.heading}</h2>}
          <div className="relative space-y-4 pl-5">
            <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-gray-200" />
            {(p.items || []).map((it, i) => (
              <div key={i} className="relative">
                <span className="absolute -left-5 top-1 w-[11px] h-[11px] rounded-full border-2 bg-white" style={{ borderColor: accent }} />
                <p className="text-xs font-semibold flex items-center gap-1" style={{ color: accent }}>
                  <Clock size={11} /> {it.time}
                </p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{it.title}</p>
                {it.desc && <p className="text-xs text-gray-500 mt-0.5">{it.desc}</p>}
              </div>
            ))}
          </div>
        </div>
      );

    case "countdown":
      return (
        <div className="px-4 py-3">
          <Countdown targetDate={p.target_date} label={p.label} accent={accent} preview={preview} />
        </div>
      );

    case "speakers":
      return (
        <div className="px-5 py-5">
          {p.heading && <h2 className="font-bold text-lg mb-4 text-gray-900">{p.heading}</h2>}
          <div className="grid grid-cols-3 gap-4">
            {(p.items || []).map((s, i) => {
              const photo = safeImg(s.photo_url);
              return (
                <div key={i} className="text-center">
                  {photo ? (
                    <div className="w-16 h-16 rounded-full mx-auto mb-2 ring-2 ring-white shadow" style={{ backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  ) : (
                    <div className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-lg shadow" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}>
                      {initials(s.name)}
                    </div>
                  )}
                  <p className="text-xs font-semibold text-gray-800 leading-tight">{s.name}</p>
                  <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{s.role}</p>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "faq":
      return (
        <div className="px-5 py-5">
          {p.heading && <h2 className="font-bold text-lg mb-3 text-gray-900">{p.heading}</h2>}
          <div className="space-y-2">
            {(p.items || []).map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
          </div>
        </div>
      );

    case "gallery": {
      const images = (p.images || []).map(safeImg).filter(Boolean);
      if (!images.length) {
        return preview ? <div className="mx-5 my-4 text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-xl">Gallery - add photos in the panel</div> : null;
      }
      return (
        <div className="px-5 py-4">
          {p.heading && <h2 className="font-bold text-lg mb-3 text-gray-900">{p.heading}</h2>}
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((img, i) => (
              <img key={i} src={img} alt="" className="w-full aspect-square object-cover rounded-lg" />
            ))}
          </div>
        </div>
      );
    }

    case "video": {
      if (!p.url) {
        return preview ? <div className="mx-5 my-4 text-xs text-gray-400 text-center py-8 bg-gray-50 rounded-xl">Video - paste a YouTube link in the panel</div> : null;
      }
      // The YouTube rewrite is a convenience, not a filter — any
      // other URL used to fall straight through into the iframe src.
      const ytMatch = p.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
      const embedUrl = ytMatch
        ? `https://www.youtube.com/embed/${ytMatch[1]}`
        : safeEmbedUrl(p.url);
      if (!embedUrl) {
        return (
          <div className="px-5 py-4">
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm underline text-gray-500 break-all">
              {p.caption || p.url}
            </a>
          </div>
        );
      }
      return (
        <div className="px-5 py-4">
          <div className="rounded-2xl overflow-hidden shadow-sm" style={{ aspectRatio: "16/9" }}>
            <iframe src={embedUrl} className={`w-full h-full ${preview ? "pointer-events-none" : ""}`} allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation" />
          </div>
          {p.caption && <p className="text-xs text-gray-400 mt-2 text-center">{p.caption}</p>}
        </div>
      );
    }

    case "map": {
      const mapUrl = safeEmbedUrl(p.embed_url);
      const search = p.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}` : null;
      return (
        <div className="px-5 py-4">
          {p.heading && <h2 className="font-bold text-lg mb-3 text-gray-900">{p.heading}</h2>}
          {mapUrl ? (
            <iframe src={mapUrl} className={`w-full rounded-2xl ${preview ? "pointer-events-none" : ""}`} style={{ height: 200, border: 0 }}
                    loading="lazy" sandbox="allow-scripts allow-same-origin" />
          ) : (
            <div className="bg-gray-50 border rounded-2xl p-4 flex items-start justify-between gap-3">
              <p className="text-sm text-gray-600">📍 {p.address || "Venue address"}</p>
              {search && (
                <a href={search} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold shrink-0 px-3 py-1.5 rounded-lg text-white" style={{ background: accent }}>
                  Directions
                </a>
              )}
            </div>
          )}
        </div>
      );
    }

    case "divider":
      return p.style === "space" ? <div className="h-8" /> : <hr className="mx-5 border-gray-200" />;

    case "html":
      return <HtmlBlock code={p.code} />;

    default:
      return null;
  }
}
