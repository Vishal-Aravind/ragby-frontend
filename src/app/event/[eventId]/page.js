"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, Calendar, MapPin, Users } from "lucide-react";
import BlockRenderer from "@/components/builder/BlockRenderer";
import DynamicForm from "@/components/builder/DynamicForm";

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
  const hasCustomPage = event.page_json && event.page_json.length > 0;
  const formFields = event.form_schema && event.form_schema.length > 0
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