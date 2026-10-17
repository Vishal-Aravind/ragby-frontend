"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Copy } from "lucide-react";

// Opening hours for one branch. Shape (shared contract with the backend):
//   null                       -> always open
//   { mon: {closed, open, close}, ... }  (24h "HH:MM"; close < open runs past
//   midnight, counted on the start day; open == close is 24 hours)
export const DAYS = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

const DEFAULT_DAY = { closed: false, open: "09:00", close: "22:00" };

// Same short list the Appointments tab uses; anything else can be typed in.
const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Karachi", "Asia/Dhaka", "Asia/Colombo",
  "Asia/Kathmandu", "Asia/Singapore", "Asia/Jakarta", "Asia/Manila",
  "Asia/Bangkok", "Asia/Hong_Kong", "Asia/Tokyo", "Australia/Sydney",
  "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin",
  "Europe/Madrid", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg",
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Toronto", "America/Sao_Paulo", "UTC",
];

export function defaultHours() {
  return Object.fromEntries(DAYS.map(([k]) => [k, { ...DEFAULT_DAY }]));
}

// Every day written out explicitly (a missing key would mean "closed" on the
// server, which is easy to do by accident).
export function normalizeHours(hours) {
  if (!hours) return null;
  return Object.fromEntries(DAYS.map(([k]) => {
    const d = hours[k];
    if (!d) return [k, { ...DEFAULT_DAY, closed: true }];
    return [k, { closed: !!d.closed, open: d.open || "09:00", close: d.close || "22:00" }];
  }));
}

function dayHint(d) {
  if (d.closed) return "Closed";
  if (d.open === d.close) return "Open 24 hours";
  if (d.close < d.open) return d.close === "00:00" ? "Until midnight" : "Closes next day";
  return "";
}

export default function HoursEditor({ hours, timezone, onChange, onTimezoneChange, disabled }) {
  const alwaysOpen = hours == null;
  const days = normalizeHours(hours) || defaultHours();
  const [customTz, setCustomTz] = useState(timezone && !TIMEZONES.includes(timezone));

  const setDay = (key, patch) => onChange({ ...days, [key]: { ...days[key], ...patch } });

  const copyMondayToAll = () => {
    const mon = days.mon;
    onChange(Object.fromEntries(DAYS.map(([k]) => [k, { ...mon }])));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700">Always open</p>
          <p className="text-xs text-gray-400">Customers can order any time of day</p>
        </div>
        <Switch checked={alwaysOpen} disabled={disabled}
          onCheckedChange={(on) => onChange(on ? null : defaultHours())} />
      </div>

      {!alwaysOpen && (
        <div className="border rounded-xl divide-y bg-white">
          {DAYS.map(([key, label]) => {
            const d = days[key];
            const hint = dayHint(d);
            return (
              <div key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <div className="flex items-center gap-2 w-32 shrink-0">
                  <Switch checked={!d.closed} disabled={disabled}
                    onCheckedChange={(on) => setDay(key, { closed: !on })}
                    aria-label={`${label} open`} />
                  <span className={`text-sm ${d.closed ? "text-gray-400" : "text-gray-800"}`}>{label}</span>
                </div>
                {d.closed ? (
                  <span className="text-xs text-gray-400">Closed</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="time" value={d.open} disabled={disabled}
                      onChange={e => e.target.value && setDay(key, { open: e.target.value })}
                      className="border rounded-lg px-2 py-1 text-sm" aria-label={`${label} opens`} />
                    <span className="text-gray-400 text-sm">–</span>
                    <input type="time" value={d.close} disabled={disabled}
                      onChange={e => e.target.value && setDay(key, { close: e.target.value })}
                      className="border rounded-lg px-2 py-1 text-sm" aria-label={`${label} closes`} />
                  </div>
                )}
                {!d.closed && hint && (
                  <span className={`text-xs ${hint === "Closes next day" ? "text-indigo-600" : "text-gray-500"}`}>{hint}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!alwaysOpen && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={copyMondayToAll} disabled={disabled}
            className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
            <Copy size={12} /> Same as Monday for all days
          </button>
          <p className="text-xs text-gray-400">
            Late night? Set a close time earlier than the open time (e.g. 6:00 PM – 2:00 AM).
          </p>
        </div>
      )}

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Timezone</label>
        <div className="flex gap-2">
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white flex-1 min-w-0"
            disabled={disabled}
            value={customTz ? "__other" : (timezone || "Asia/Kolkata")}
            onChange={e => {
              if (e.target.value === "__other") { setCustomTz(true); return; }
              setCustomTz(false);
              onTimezoneChange(e.target.value);
            }}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
            <option value="__other">Other…</option>
          </select>
          {customTz && (
            <Input className="flex-1 min-w-0" placeholder="e.g. Asia/Riyadh" disabled={disabled}
              value={timezone || ""} onChange={e => onTimezoneChange(e.target.value.trim())} />
          )}
        </div>
      </div>
    </div>
  );
}
