"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Calendar, MapPin, Users } from "lucide-react";

import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────
// PUBLIC BLOCK RENDERER — turns page_json into actual page
// ─────────────────────────────────────────────────────────
function Countdown({ targetDate, label, accent }) {
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

  if (!targetDate || !timeLeft) return null;

  return (
    <div className="text-center py-5 px-4 rounded-xl" style={{ background: `${accent}11` }}>
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-center justify-center gap-4">
        {[["Days", timeLeft.days], ["Hours", timeLeft.hours], ["Mins", timeLeft.mins]].map(([l, v]) => (
          <div key={l}>
            <p className="text-2xl font-bold" style={{ color: accent }}>{v}</p>
            <p className="text-xs text-gray-400">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockRenderer({ blocks, accent }) {
  return (
    <div>
      {(blocks || []).map(block => {
        const p = block.props;
        switch (block.type) {
          case "hero":
            return (
              <div key={block.id} className="relative" style={{ minHeight: 200, background: p.image_url ? `url(${p.image_url}) center/cover` : accent }}>
                <div className="flex flex-col justify-end p-6" style={{ minHeight: 200, background: p.overlay ? "linear-gradient(transparent, rgba(0,0,0,0.65))" : "none" }}>
                  <h1 className="text-white font-bold text-2xl">{p.title}</h1>
                  {p.subtitle && <p className="text-white opacity-90 text-sm mt-1">{p.subtitle}</p>}
                </div>
              </div>
            );

          case "text":
            return (
              <div key={block.id} className="px-4 py-4" style={{ textAlign: p.align }}>
                {p.heading && <h2 className="font-bold text-lg mb-2 text-gray-900">{p.heading}</h2>}
                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{p.body}</p>
              </div>
            );

          case "countdown":
            return (
              <div key={block.id} className="px-4 py-3">
                <Countdown targetDate={p.target_date} label={p.label} accent={accent} />
              </div>
            );

          case "speakers":
            return (
              <div key={block.id} className="px-4 py-4">
                {p.heading && <h2 className="font-bold text-lg mb-3 text-gray-900">{p.heading}</h2>}
                <div className="grid grid-cols-3 gap-3">
                  {p.items.map((s, i) => (
                    <div key={i} className="text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-200 mx-auto mb-1.5" style={s.photo_url ? { backgroundImage: `url(${s.photo_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}} />
                      <p className="text-xs font-semibold text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400 truncate">{s.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            );

          case "faq":
            return (
              <div key={block.id} className="px-4 py-4">
                {p.heading && <h2 className="font-bold text-lg mb-3 text-gray-900">{p.heading}</h2>}
                <div className="space-y-2">
                  {p.items.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
                </div>
              </div>
            );

          case "gallery":
            return (
              <div key={block.id} className="px-4 py-4 grid grid-cols-3 gap-1.5">
                {p.images.map((img, i) => (
                  <img key={i} src={img} className="aspect-square object-cover rounded-lg" />
                ))}
              </div>
            );

          case "video": {
            if (!p.url) return null;
            let embedUrl = p.url;
            const ytMatch = p.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
            if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
            return (
              <div key={block.id} className="px-4 py-4">
                <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
                  <iframe src={embedUrl} className="w-full h-full" allowFullScreen />
                </div>
                {p.caption && <p className="text-xs text-gray-400 mt-2 text-center">{p.caption}</p>}
              </div>
            );
          }

          case "map":
            return (
              <div key={block.id} className="px-4 py-4">
                {p.embed_url ? (
                  <iframe src={p.embed_url} className="w-full rounded-xl" style={{ height: 200, border: 0 }} loading="lazy" />
                ) : (
                  <div className="bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-500">📍 {p.address}</div>
                )}
              </div>
            );

          case "divider":
            return p.style === "space"
              ? <div key={block.id} className="h-8" />
              : <hr key={block.id} className="mx-4 border-gray-200" />;

          case "html":
            // Sanitized — strip script tags for safety
            const safeHtml = (p.code || "").replace(/<script[\s\S]*?<\/script>/gi, "");
            return <div key={block.id} className="px-4 py-2" dangerouslySetInnerHTML={{ __html: safeHtml }} />;

          default:
            return null;
        }
      })}
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2.5 text-left">
        <span className="text-sm font-medium text-gray-800">{q}</span>
        <span className="text-gray-400 text-lg leading-none">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-3 pb-2.5 text-sm text-gray-500">{a}</div>}
    </div>
  );
}

import { useState } from "react";

function DynamicForm({ fields, accent, onSubmit, submitting }) {
  const [values, setValues] = useState(
    Object.fromEntries(fields.map(f => [f.id, f.type === "checkbox" ? false : ""]))
  );
  const [error, setError] = useState(null);

  const setVal = (id, v) => setValues(prev => ({ ...prev, [id]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    for (const f of fields) {
      if (f.required && !values[f.id]) {
        setError(`${f.label} is required`);
        return;
      }
    }
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
      {fields.map(f => (
        <div key={f.id} className="space-y-1">
          <label className="text-xs text-gray-500">{f.label}{f.required && " *"}</label>
          {f.type === "textarea" ? (
            <textarea rows={3} value={values[f.id]} onChange={e => setVal(f.id, e.target.value)}
              className="w-full border rounded-xl px-3 py-3 text-sm outline-none focus:ring-2" />
          ) : f.type === "dropdown" ? (
            <select value={values[f.id]} onChange={e => setVal(f.id, e.target.value)}
              className="w-full border rounded-xl px-3 py-3 text-sm outline-none bg-white">
              <option value="">Select...</option>
              {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={values[f.id]} onChange={e => setVal(f.id, e.target.checked)} />
              {f.label}
            </label>
          ) : (
            <input
              type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : f.type === "number" ? "number" : "text"}
              value={values[f.id]} onChange={e => setVal(f.id, e.target.value)}
              className="w-full border rounded-xl px-3 py-3 text-sm outline-none focus:ring-2" />
          )}
        </div>
      ))}
      <button type="submit" disabled={submitting}
        className="w-full py-4 rounded-xl text-white font-semibold text-base disabled:opacity-60"
        style={{ background: accent }}>
        {submitting ? "Registering..." : "Confirm Registration ✓"}
      </button>
    </form>
  );
}

export default function EventRegistrationPage() {
  const { eventId } = useParams();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/public/events/${eventId}`)
      .then(r => {
        if (!r.ok) throw new Error("Event not found");
        return r.json();
      })
      .then(data => { setEvent(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [eventId]);

  const accent = event?.accent_color || "#6366f1";

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          project_id: event.project_id,
          data: values,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");
      setSubmitted(true);
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8f9fa" }}>
      <div className="w-10 h-10 rounded-full animate-spin" style={{ border: "3px solid #e5e7eb", borderTopColor: accent }} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f8f9fa" }}>
      <div className="text-center space-y-3">
        <p className="text-2xl">😔</p>
        <p className="text-gray-600 font-medium">Registration unavailable</p>
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f8f9fa" }}>
      <div className="text-center space-y-5 max-w-sm w-full">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: accent }}>
          <Check size={28} color="white" strokeWidth={3} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">You're Registered!</h2>
          <p className="text-sm text-gray-500 mt-1">{event.title}</p>
        </div>
        <p className="text-xs text-gray-400">A confirmation has been sent to your WhatsApp.</p>
      </div>
    </div>
  );

  const spotsFull = event.capacity && event.spots_left <= 0;
  const registrationClosed = event.registration_open === false;
  const hasCustomPage = Array.isArray(event?.page_json) && event.page_json.length > 0;
  const formFields = Array.isArray(event?.form_schema) && event.form_schema.length > 0
    ? event.form_schema
    : [
        { id: "name", type: "text", label: "Your name", required: true },
        { id: "phone", type: "phone", label: "WhatsApp number", required: true },
      ];

  return (
    <div className="min-h-screen pb-10" style={{ background: "#f8f9fa", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {hasCustomPage ? (
        <div className="max-w-md mx-auto bg-white">
          <BlockRenderer blocks={event.page_json} accent={accent} />
        </div>
      ) : (
        <>
          {event.banner_url && (
            <div className="w-full" style={{ maxHeight: 220, overflow: "hidden" }}>
              <img src={event.banner_url} alt={event.title} className="w-full object-cover" style={{ maxHeight: 220 }} />
            </div>
          )}
          <div className="px-4 pt-6 pb-4" style={{ background: accent }}>
            <h1 className="text-white font-bold text-xl">{event.title}</h1>
            {event.description && <p className="text-white text-sm opacity-90 mt-1">{event.description}</p>}
          </div>
        </>
      )}

      <div className="px-4 pt-4 max-w-md mx-auto space-y-4">
        {/* Event details card */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
          {event.event_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={15} style={{ color: accent }} />
              <span className="text-gray-700">{formatDate(event.event_date)}{event.event_time ? ` • ${event.event_time}` : ""}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={15} style={{ color: accent }} />
              <span className="text-gray-700">{event.location}</span>
            </div>
          )}
          {event.capacity && (
            <div className="flex items-center gap-2 text-sm">
              <Users size={15} style={{ color: accent }} />
              <span className="text-gray-700">
                {event.spots_left > 0 ? `${event.spots_left} spots left` : "Fully booked"}
                {" "}<span className="text-gray-400">({event.registered_count}/{event.capacity} registered)</span>
              </span>
            </div>
          )}
        </div>

        {/* Registration form or closed message */}
        {spotsFull || registrationClosed ? (
          <div className="bg-white rounded-2xl shadow-sm border p-6 text-center space-y-2">
            <p className="text-gray-600 font-medium">{spotsFull ? "This event is fully booked" : "Registration is closed"}</p>
            {event.contact_phone && <p className="text-sm text-gray-400">Call {event.contact_phone} for more info</p>}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border p-4">
            <p className="font-semibold text-sm text-gray-800 mb-3">Register now</p>
            <DynamicForm fields={formFields} accent={accent} onSubmit={handleSubmit} submitting={submitting} />
          </div>
        )}
      </div>
    </div>
  );
}