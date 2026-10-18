"use client";

import { Check } from "lucide-react";

const STEPS = ["Cart", "Order type", "Details", "Summary"];

/** 1 Cart — 2 Order type — 3 Details — 4 Summary. Completed steps are clickable; later ones are not. */
export default function Stepper({ step, accent, onGo }) {
  return (
    <ol className="flex items-center px-4 py-2.5 bg-white border-b border-gray-100" aria-label="Checkout steps">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const current = n === step;
        const done = n < step;
        const clickable = done;
        return (
          <li key={label} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onGo(n)}
              aria-current={current ? "step" : undefined}
              className="flex flex-col items-center gap-1 min-w-[52px] disabled:cursor-default"
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2"
                style={
                  current
                    ? { background: accent, borderColor: accent, color: "white" }
                    : done
                      ? { background: "white", borderColor: accent, color: accent }
                      : { background: "white", borderColor: "#d1d5db", color: "#9ca3af" }
                }
              >
                {done ? <Check size={12} strokeWidth={3} /> : n}
              </span>
              <span
                className="text-[10px] font-semibold whitespace-nowrap"
                style={{ color: current ? "#111827" : done ? accent : "#9ca3af" }}
              >
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="flex-1 h-0.5 mx-1 -mt-4 rounded" style={{ background: n < step ? accent : "#e5e7eb" }} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
