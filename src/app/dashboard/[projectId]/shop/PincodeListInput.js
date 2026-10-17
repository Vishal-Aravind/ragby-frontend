"use client";

import { useState } from "react";
import { X } from "lucide-react";

const MAX_PINCODES = 500;
const IN_PIN = /^[1-9]\d{5}$/;                       // India: 6 digits
const OTHER_POSTAL = /^[A-Z0-9][A-Z0-9 -]{1,8}[A-Z0-9]$/; // other regions (server re-checks)

// Splits pasted text into postal codes. Commas, semicolons and new lines
// always separate; spaces separate only between all-digit codes, so a UK
// style "SW1A 1AA" stays one code.
function splitCodes(text) {
  return String(text || "")
    .split(/[,;\n\r\t]+/)
    .flatMap(part => (/^[\d\s]+$/.test(part) ? part.split(/\s+/) : [part]))
    .map(s => s.trim().toUpperCase().replace(/\s+/g, " "))
    .filter(Boolean);
}

function isValid(code) {
  return /^\d+$/.test(code) ? IN_PIN.test(code) : OTHER_POSTAL.test(code);
}

export default function PincodeListInput({ value, onChange, disabled }) {
  const pins = Array.isArray(value) ? value : [];
  const [draft, setDraft] = useState("");
  const [rejected, setRejected] = useState([]);

  const add = (text) => {
    const codes = splitCodes(text);
    if (codes.length === 0) return;
    const bad = codes.filter(c => !isValid(c));
    const next = [...pins];
    for (const c of codes) {
      if (isValid(c) && !next.includes(c) && next.length < MAX_PINCODES) next.push(c);
    }
    setRejected(bad);
    if (next.length !== pins.length) onChange(next);
    setDraft("");
  };

  const remove = (code) => onChange(pins.filter(p => p !== code));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200"
          placeholder="Type or paste pincodes, e.g. 600042, 600091"
          value={draft}
          disabled={disabled}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
          }}
          onPaste={e => {
            const text = e.clipboardData?.getData("text");
            if (text && /[,;\n\s]/.test(text.trim())) { e.preventDefault(); add(draft + " " + text); }
          }}
          onBlur={() => draft.trim() && add(draft)}
        />
        <button type="button" onClick={() => add(draft)} disabled={disabled || !draft.trim()}
          className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50">
          Add
        </button>
      </div>

      {rejected.length > 0 && (
        <p className="text-xs text-red-600">
          Skipped (not a valid pincode): {rejected.slice(0, 10).join(", ")}{rejected.length > 10 ? ` and ${rejected.length - 10} more` : ""}
        </p>
      )}

      {pins.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {pins.map(p => (
            <span key={p} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full pl-2.5 pr-1 py-0.5">
              {p}
              {!disabled && (
                <button type="button" onClick={() => remove(p)} aria-label={`Remove ${p}`}
                  className="rounded-full p-0.5 hover:bg-gray-200">
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {pins.length === 0 ? "No pincodes added" : `${pins.length} pincode${pins.length === 1 ? "" : "s"}`}
          {pins.length >= MAX_PINCODES && " (maximum reached)"}
        </span>
        {pins.length > 0 && !disabled && (
          <button type="button" onClick={() => onChange([])} className="underline hover:text-gray-600">Clear all</button>
        )}
      </div>
    </div>
  );
}
