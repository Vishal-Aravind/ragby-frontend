"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Clock, Calendar, User, Phone, FileText } from "lucide-react";

export default function BookingPage() {
  const { projectId } = useParams();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const rescheduleId = searchParams.get("reschedule") || "";

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Step management: 1=date, 2=time, 3=details, 4=confirmed
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/public/appointments/${projectId}/settings`)
      .then(r => {
        if (!r.ok) throw new Error("Booking not available");
        return r.json();
      })
      .then(data => { setSettings(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [projectId]);

  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    const dateStr = formatDate(selectedDate);
    fetch(`/api/public/appointments/${projectId}/slots?date=${dateStr}`)
      .then(r => r.json())
      .then(data => { setSlots(data.slots || []); setSlotsLoading(false); })
      .catch(() => { setSlots([]); setSlotsLoading(false); });
  }, [selectedDate]);

  const accent = settings?.accent_color || "#6366f1";
  const isReschedule = !!rescheduleId;
  const service = settings?.service_name || "Appointment";
  const duration = settings?.duration_minutes || 30;
  const advanceDays = settings?.advance_booking_days || 30;

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatDateDisplay = (date) => {
    return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const isDateAvailable = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + advanceDays);

    if (date < today || date > maxDate) return false;

    const dayMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const dayKey = dayMap[date.getDay()];
    const wh = settings?.working_hours || {};
    return wh[dayKey]?.enabled !== false;
  };

  // Calendar rendering
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const handleDateSelect = (date) => {
    if (!isDateAvailable(date)) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep(2);
  };

  const handleSlotSelect = (slot) => {
    // Strip capacity label e.g. "10:00 (2 left)" → "10:00"
    const cleanSlot = slot.split(" (")[0];
    setSelectedSlot(cleanSlot);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          customer_name: name.trim(),
          customer_phone: phone,
          appointment_date: formatDate(selectedDate),
          start_time: selectedSlot,
          notes: notes.trim() || null,
          reschedule_id: rescheduleId || null,
        }),
      });
      if (!res.ok) throw new Error("Booking failed");
      const data = await res.json();
      setBooking(data);
      setStep(4);
    } catch (e) {
      alert("Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openWhatsApp = () => {
    window.location.href = `https://wa.me/${(settings?.store_phone || "15556458639").replace(/\D/g, "")}`;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8f9fa" }}>
      <div className="w-8 h-8 rounded-full animate-spin"
        style={{ border: "3px solid #e5e7eb", borderTopColor: accent }} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f8f9fa" }}>
      <div className="text-center space-y-2">
        <p className="text-2xl">😔</p>
        <p className="text-gray-600 font-medium text-sm">Booking unavailable</p>
        <p className="text-xs text-gray-400">{error}</p>
      </div>
    </div>
  );

  // Step 4 — Confirmed
  if (step === 4) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f8f9fa", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="w-full max-w-[360px] bg-white rounded-2xl shadow-sm border p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: accent }}>
          <Check size={24} color="white" strokeWidth={3} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Booking Confirmed!</h2>
          <p className="text-xs text-gray-400 mt-0.5">#{booking?.appointment_id?.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="bg-gray-50 rounded-xl border p-3 text-left space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={13} style={{ color: accent }} />
            <span className="text-gray-600">{booking?.date}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock size={13} style={{ color: accent }} />
            <span className="text-gray-600">{booking?.time} ({duration} mins)</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User size={13} style={{ color: accent }} />
            <span className="text-gray-600">{name}</span>
          </div>
        </div>
        <p className="text-xs text-gray-400">A confirmation has been sent to your WhatsApp.</p>
        <button onClick={openWhatsApp}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm"
          style={{ background: accent }}>
          💬 Open WhatsApp
        </button>
      </div>
    </div>
  );

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#f8f9fa", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="w-full max-w-[360px] bg-white rounded-2xl shadow-sm border overflow-hidden">

        {/* Header */}
        <div className="px-4 pt-4 pb-3" style={{ background: accent }}>
          <h1 className="text-white font-bold text-base">{service}</h1>
          <span className="text-white text-[11px] opacity-80 flex items-center gap-1 mt-0.5">
            <Clock size={10} /> {duration} mins
          </span>

          {/* Steps */}
          <div className="flex items-center gap-1.5 mt-3">
            {["Date", "Time", "Details"].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  step >= i + 1 ? "bg-white text-gray-800" : "bg-white bg-opacity-20 text-white opacity-60"
                }`}>
                  {step > i + 1 ? <Check size={9} /> : null}
                  {s}
                </div>
                {i < 2 && <div className="w-3 h-px bg-white opacity-30" />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4">

          {/* Step 1 — Date picker */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">
                  <ChevronLeft size={14} />
                </button>
                <span className="font-semibold text-sm">{monthName}</span>
                <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5 text-center">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                  <div key={d} className="text-[10px] text-gray-400 font-medium py-1">{d}</div>
                ))}
                {days.map((date, i) => (
                  <div key={i}>
                    {date ? (
                      <button
                        onClick={() => handleDateSelect(date)}
                        disabled={!isDateAvailable(date)}
                        className={`w-full aspect-square rounded-lg text-xs font-medium transition-all ${
                          selectedDate && formatDate(date) === formatDate(selectedDate)
                            ? "text-white"
                            : isDateAvailable(date)
                            ? "hover:bg-gray-100 text-gray-800"
                            : "text-gray-300 cursor-not-allowed"
                        }`}
                        style={selectedDate && formatDate(date) === formatDate(selectedDate)
                          ? { background: accent } : {}}>
                        {date.getDate()}
                      </button>
                    ) : <div />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Time slots */}
          {step === 2 && (
            <div className="space-y-3">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs text-gray-500">
                <ChevronLeft size={12} /> {formatDateDisplay(selectedDate)}
              </button>
              <p className="font-semibold text-xs text-gray-800">Available times</p>
              {slotsLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-xs">No available slots on this day</p>
                  <button onClick={() => setStep(1)} className="text-xs mt-1.5 underline" style={{ color: accent }}>
                    Choose another date
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {slots.map(slot => (
                    <button key={slot} onClick={() => handleSlotSelect(slot)}
                      className="py-2 rounded-lg border text-xs font-medium transition-all"
                      style={selectedSlot === slot
                        ? { background: accent, color: "white", borderColor: accent }
                        : { borderColor: "#e5e7eb", color: "#374151" }}>
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Details form */}
          {step === 3 && (
            <div className="space-y-3">
              <button onClick={() => setStep(2)} className="flex items-center gap-1 text-xs text-gray-500">
                <ChevronLeft size={12} /> {formatDateDisplay(selectedDate)} at {selectedSlot}
              </button>

              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 flex items-center gap-1">
                  <User size={10} /> Your name
                </label>
                <input type="text" placeholder="Enter your name"
                  value={name} onChange={e => setName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{ "--tw-ring-color": accent }}
                  autoFocus />
              </div>

              {phone && (
                <div className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2 border">
                  <Phone size={12} className="text-gray-400" />
                  <span className="text-gray-600">+{phone}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] text-gray-500 flex items-center gap-1">
                  <FileText size={10} /> Notes (optional)
                </label>
                <textarea placeholder="Any special requests..."
                  value={notes} onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-2" />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-2.5 space-y-1 border">
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Service</span><span className="font-medium text-gray-800">{service}</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Date</span><span className="font-medium text-gray-800">{formatDateDisplay(selectedDate)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Time</span><span className="font-medium text-gray-800">{selectedSlot} · {duration} mins</span>
                </div>
              </div>

              <button onClick={handleSubmit}
                disabled={submitting || !name.trim()}
                className="w-full py-2.5 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: accent }}>
                {submitting
                  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Booking...</>
                  : isReschedule ? "Confirm Reschedule ✓" : "Confirm Booking ✓"
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
