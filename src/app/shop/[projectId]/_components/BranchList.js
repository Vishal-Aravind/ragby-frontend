"use client";

import { MapPin, ChevronRight, Clock, Bike, ShoppingBag } from "lucide-react";
import { formatKm, formatMoney } from "../_lib/shopApi";

function StatusChip({ status }) {
  if (!status) return null;
  let cls = "bg-gray-100 text-gray-600";
  if (status.can_order) cls = "bg-green-50 text-green-700";
  else if (status.reason === "paused") cls = "bg-amber-50 text-amber-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: status.can_order ? "#16a34a" : status.reason === "paused" ? "#d97706" : "#9ca3af" }}
      />
      {status.label || (status.can_order ? "Open now" : "Closed")}
    </span>
  );
}

function BranchCard({ branch, accent, currency, onPick }) {
  const km = formatKm(branch.distance_km);
  return (
    <button
      onClick={() => onPick(branch)}
      className="w-full text-left bg-white rounded-2xl border p-4 shadow-sm active:scale-[0.99] transition"
      style={{ borderColor: branch.is_nearest ? accent : "#f3f4f6", borderWidth: branch.is_nearest ? 1.5 : 1 }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-base leading-tight">{branch.name}</h3>
            {branch.is_nearest && (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: "#16a34a" }}>
                Nearest
              </span>
            )}
          </div>
          {branch.address && <p className="text-xs text-gray-500 line-clamp-2">{branch.address}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip status={branch.status} />
            {km && <span className="text-xs font-medium text-gray-600">{km} away</span>}
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-600">
            {branch.pickup_enabled && (
              <span className="inline-flex items-center gap-1"><ShoppingBag size={12} />Pickup</span>
            )}
            {branch.delivery_available && (
              <span className="inline-flex items-center gap-1"><Bike size={12} />Delivery</span>
            )}
            {branch.delivers_here === true && (
              <span className="font-semibold text-green-700">Delivers to you</span>
            )}
            {branch.prep_minutes ? (
              <span className="inline-flex items-center gap-1"><Clock size={12} />Ready in ~{branch.prep_minutes} min</span>
            ) : null}
            {Number(branch.min_order_value) > 0 && (
              <span>Min order {formatMoney(currency, branch.min_order_value)}</span>
            )}
          </div>
        </div>
        <ChevronRight size={18} className="text-gray-300 shrink-0 mt-1" />
      </div>
    </button>
  );
}

export default function BranchList({
  storeName, branches, originLabel, hasDistances, accent, currency, cartCount, onPick, onChangeLocation,
}) {
  return (
    <div className="min-h-screen pb-10" style={{ background: "#f8faf8" }}>
      <div className="px-4 pt-6 pb-4 space-y-1">
        {storeName && <p className="text-sm font-semibold" style={{ color: accent }}>{storeName}</p>}
        <h1 className="text-2xl font-bold text-gray-900">Choose a branch</h1>
        <button onClick={onChangeLocation} className="text-sm text-gray-600 inline-flex items-center gap-1">
          <MapPin size={14} />
          {originLabel || "Location not set"}
          <span className="font-semibold" style={{ color: accent }}>· change</span>
        </button>
        {!hasDistances && (
          <p className="text-xs text-gray-500">
            {originLabel
              ? "We couldn't work out distances for that location — all branches are listed below."
              : "Allow location to see the nearest branch."}
          </p>
        )}
        {cartCount > 0 && (
          <p className="text-xs text-amber-700">Switching to another branch clears your cart — menus differ by branch.</p>
        )}
      </div>
      <div className="px-4 space-y-3">
        {branches.map((b) => (
          <BranchCard key={b.id} branch={b} accent={accent} currency={currency} onPick={onPick} />
        ))}
        {branches.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-12">No branches are available right now.</p>
        )}
      </div>
    </div>
  );
}
