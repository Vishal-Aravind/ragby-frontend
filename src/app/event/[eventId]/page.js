"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Calendar, MapPin, Users } from "lucide-react";
// Shared with the page builder, so the merchant's design is exactly what
// visitors see.
import EventBlocks, { DynamicForm, eventInfo } from "@/components/builder/EventBlocks";

export default function EventRegistrationPage() {
  const { eventId } = useParams();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(null);   // the registration result once done
  const [submitting, setSubmitting] = useState(false);
  const [popup, setPopup] = useState(null);   // registration error, shown in the page's own popup

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
        // project_id used to be sent from here. The backend ignored it for
        // the registration itself but mixed it into the rate-limit key, so
        // sending it at all was what made that limit forgeable.
        body: JSON.stringify({
          event_id: eventId,
          data: values,
        }),
      });
      // Was an unguarded res.json(), so an empty or non-JSON response
      // showed the visitor a raw "Unexpected token" parse error.
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || "Registration failed");
      setSubmitted(data);
    } catch (e) {
      setPopup(e.message);
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
        {(event.event_date || event.event_time || event.location) && (
          <div className="bg-white border rounded-2xl p-4 text-sm text-gray-700 space-y-1.5 text-left">
            {(event.event_date || event.event_time) && (
              <p className="flex items-center gap-2"><Calendar size={14} style={{ color: accent }} />
                {event.event_date ? formatDate(event.event_date) : ""}{event.event_date && event.event_time ? " • " : ""}{event.event_time || ""}</p>
            )}
            {event.location && <p className="flex items-center gap-2"><MapPin size={14} style={{ color: accent }} />{event.location}</p>}
          </div>
        )}
        {submitted.booking_id && (
          <p className="text-sm text-gray-600">Booking ID: <span className="font-mono font-semibold">#{submitted.booking_id}</span></p>
        )}
        <p className="text-xs text-gray-400">
          {submitted.confirmation_sent
            ? "A confirmation has been sent to your WhatsApp."
            : "Your spot is saved. Please take a screenshot of this page for your reference."}
        </p>
      </div>
    </div>
  );

  const spotsFull = event.capacity && event.spots_left <= 0;
  const registrationClosed = event.registration_open === false;
  const hasCustomPage = Array.isArray(event?.page_json) && event.page_json.length > 0;
  // Older custom pages saved before the registration form became a real,
  // reorderable block won't have one in page_json — fall back to the fixed
  // section below for those, so they don't lose their form entirely.
  const hasRegistrationFormBlock = hasCustomPage && event.page_json.some(b => b.type === "registration_form");
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
          <EventBlocks
            blocks={event.page_json}
            accent={accent}
            formFields={formFields}
            onSubmit={handleSubmit}
            submitting={submitting}
            spotsFull={spotsFull}
            registrationClosed={registrationClosed}
            contactPhone={event.contact_phone}
            info={eventInfo(event)}
          />
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
        {/* Event details card - a designed page with a banner shows these
            right under the banner instead (EventBlocks InfoCard). */}
        {!(hasCustomPage && event.page_json.some(b => b.type === "hero")) && (
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
        )}

        {/* Registration form or closed message — skipped when the custom
            page already renders it inline as a registration_form block,
            to avoid showing the form twice */}
        {!hasRegistrationFormBlock && (
          spotsFull || registrationClosed ? (
            <div className="bg-white rounded-2xl shadow-sm border p-6 text-center space-y-2">
              <p className="text-gray-600 font-medium">{spotsFull ? "This event is fully booked" : "Registration is closed"}</p>
              {event.contact_phone && <p className="text-sm text-gray-400">Call {event.contact_phone} for more info</p>}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border p-4">
              <p className="font-semibold text-sm text-gray-800 mb-3">Register now</p>
              <DynamicForm fields={formFields} accent={accent} onSubmit={handleSubmit} submitting={submitting} />
            </div>
          )
        )}
      </div>

      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/40" onClick={() => setPopup(null)}>
          <div role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 text-center space-y-4">
            <p className="text-sm text-gray-700">{popup}</p>
            <button type="button" autoFocus onClick={() => setPopup(null)}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: accent }}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}