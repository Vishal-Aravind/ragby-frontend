"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { looksPersonal } from "./personalColumns";

// Tables and columns of a database with checkboxes: what the AI may query.
// Used both before connecting (Database tab) and when editing a connected
// database (DatabaseColumnsDialog), so the two look and behave the same.
//   schema:   {table: [columns]}
//   allowed:  {table: Set(columns)}
//   onChange: (nextAllowed) => void
export default function DatabaseColumnPicker({ schema, allowed, onChange }) {
  // Small databases open fully; big ones start collapsed.
  const [expanded, setExpanded] = useState(() => {
    const tables = Object.keys(schema);
    return Object.fromEntries(tables.map((t) => [t, tables.length <= 6]));
  });

  const count = (table) => allowed[table]?.size || 0;

  function toggleTable(table) {
    onChange({ ...allowed, [table]: count(table) > 0 ? new Set() : new Set(schema[table]) });
  }

  function toggleCol(table, col) {
    const cols = new Set(allowed[table] || []);
    cols.has(col) ? cols.delete(col) : cols.add(col);
    onChange({ ...allowed, [table]: cols });
  }

  const tablesOn = Object.keys(schema).filter((t) => count(t) > 0).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Choose what the AI can access</p>
        <span className="text-xs text-gray-400">
          {tablesOn} / {Object.keys(schema).length} tables selected
        </span>
      </div>
      <p className="text-xs text-gray-500">
        The AI can only read ticked columns. Columns that look like personal data
        (emails, phone numbers) start unticked.
      </p>
      <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
        {Object.entries(schema).map(([table, cols]) => (
          <div key={table}>
            <div
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 cursor-pointer select-none"
              onClick={() => setExpanded((prev) => ({ ...prev, [table]: !prev[table] }))}
            >
              <input
                type="checkbox"
                checked={count(table) > 0}
                ref={(el) => { if (el) el.indeterminate = count(table) > 0 && count(table) < cols.length; }}
                onChange={() => toggleTable(table)}
                onClick={(e) => e.stopPropagation()}
              />
              {expanded[table] ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
              <span className="text-sm font-mono font-medium">{table}</span>
              <span className="text-xs text-gray-400 ml-auto">{count(table)}/{cols.length} cols</span>
            </div>
            {expanded[table] && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-8 py-2">
                {cols.map((col) => (
                  <label key={col} className="flex items-center gap-2 cursor-pointer py-0.5 min-w-0">
                    <input type="checkbox" checked={allowed[table]?.has(col) || false} onChange={() => toggleCol(table, col)} />
                    <span className="text-xs font-mono text-gray-600 truncate">{col}</span>
                    {looksPersonal(col) && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded px-1 shrink-0">personal</span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
