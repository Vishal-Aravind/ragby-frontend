"use client";
import { useState } from "react";

export default function DynamicForm({ fields, accent, onSubmit, submitting }) {
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