"use client";

import { Clock, PauseCircle } from "lucide-react";

/** Strip under the menu header whenever the branch can't take orders. The page
 *  renders it inside its sticky header wrapper, so it stays pinned with it. */
export default function ClosedBanner({ status, branchName }) {
  if (!status || status.can_order) return null;
  const paused = status.reason === "paused";
  const inactive = status.reason === "inactive";
  const text = paused
    ? `${branchName || "This branch"} isn't taking orders right now.`
    : inactive
      ? `${branchName || "This branch"} isn't taking orders.`
      : status.label || "Closed now";

  return (
    <div
      role="status"
      className="px-4 py-2.5 flex items-center gap-2 text-sm font-semibold border-b"
      style={{
        background: paused ? "#fffbeb" : "#f3f4f6",
        color: paused ? "#92400e" : "#374151",
        borderColor: paused ? "#fde68a" : "#e5e7eb",
      }}
    >
      {paused ? <PauseCircle size={16} className="shrink-0" /> : <Clock size={16} className="shrink-0" />}
      <span className="flex-1">
        {text}
        <span className="block text-xs font-normal opacity-80">You can browse the menu — ordering opens when we do.</span>
      </span>
    </div>
  );
}
