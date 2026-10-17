"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Store } from "lucide-react";

export const ALL_BRANCHES = "all";

// green = open & taking orders, amber = paused, grey = closed / turned off.
export function branchTone(branch) {
  if (!branch || branch.is_active === false) return "off";
  const s = branch.status;
  if (s?.reason === "paused" || (s?.is_open && branch.accepting_orders === false)) return "paused";
  if (s?.can_order || (s?.is_open && !s?.reason)) return "open";
  return "closed";
}

const DOT = { open: "bg-green-500", paused: "bg-amber-400", closed: "bg-gray-300", off: "bg-gray-300" };

export function StatusDot({ branch, className = "" }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${DOT[branchTone(branch)]} ${className}`} />;
}

function subLabel(branch) {
  if (branch.is_active === false) return "Turned off";
  return branch.status?.label || "";
}

export default function BranchSelector({ branches, value, onChange, allowAll = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!branches || branches.length <= 1) return null;

  const current = value === ALL_BRANCHES ? null : branches.find(b => b.id === value);
  const pick = (id) => { onChange(id); setOpen(false); };

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="flex items-center gap-2 border rounded-lg bg-white px-3 py-2 text-sm hover:border-gray-400 min-w-[200px] max-w-full">
        {current ? <StatusDot branch={current} /> : <Store size={14} className="text-gray-400" />}
        <span className="font-medium text-gray-800 truncate">{current ? current.name : "All branches"}</span>
        <ChevronDown size={14} className="ml-auto text-gray-400" />
      </button>

      {open && (
        <ul role="listbox"
          className="absolute z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto bg-white border rounded-xl shadow-lg py-1">
          {allowAll && (
            <li>
              <button type="button" onClick={() => pick(ALL_BRANCHES)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left">
                <Store size={14} className="text-gray-400" />
                <span className="flex-1 font-medium text-gray-800">All branches</span>
                {value === ALL_BRANCHES && <Check size={14} className="text-gray-600" />}
              </button>
            </li>
          )}
          {branches.map(b => (
            <li key={b.id}>
              <button type="button" onClick={() => pick(b.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left">
                <StatusDot branch={b} />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-gray-800 truncate">
                    {b.name}{b.is_default && <span className="ml-1.5 text-xs font-normal text-gray-400">Default</span>}
                  </span>
                  <span className="block text-xs text-gray-400 truncate">{subLabel(b)}</span>
                </span>
                {value === b.id && <Check size={14} className="text-gray-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
