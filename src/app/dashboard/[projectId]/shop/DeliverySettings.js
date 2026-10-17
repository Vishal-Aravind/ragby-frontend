"use client";

import { Switch } from "@/components/ui/switch";
import { AlertTriangle } from "lucide-react";
import PincodeListInput from "./PincodeListInput";

const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));

// Problems with the delivery setup, worded for the merchant. They don't
// block saving (a merchant may set things up in steps), but until they're
// fixed customers can't choose delivery.
export function deliveryProblems(form, hasLocation) {
  if (!form.delivery_enabled) return [];
  const out = [];
  const radius = num(form.max_delivery_km);
  const hasPins = (form.pincodes || []).length > 0;
  if (!radius && !hasPins) {
    out.push("Delivery is on but no delivery area is set. Add a max distance or at least one pincode, otherwise customers can only pick up.");
  }
  if (radius && !hasLocation) {
    out.push("A max distance needs the branch location. Place the pin on the map above.");
  }
  if (num(form.delivery_per_km) > 0 && !hasLocation) {
    out.push("A per-km fee needs the branch location to measure distance. Place the pin on the map above.");
  }
  return out;
}

function MoneyField({ label, hint, value, onChange, currency, placeholder, disabled, suffix }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <div className="flex items-center border rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-gray-200">
        {currency && <span className="pl-3 text-sm text-gray-400">{currency}</span>}
        <input type="number" min="0" step="any" inputMode="decimal" disabled={disabled}
          className="flex-1 min-w-0 px-2 py-2 text-sm outline-none bg-transparent"
          placeholder={placeholder} value={value ?? ""}
          onChange={e => onChange(e.target.value)} />
        {suffix && <span className="pr-3 text-sm text-gray-400">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function helperText(form, currency) {
  const radius = num(form.max_delivery_km);
  const pins = (form.pincodes || []).length;
  const area = [
    radius ? `within ${radius} km` : null,
    pins ? `in ${pins === 1 ? "this pincode" : `these ${pins} pincodes`}` : null,
  ].filter(Boolean).join(" OR ");
  if (!area) return null;

  const base = num(form.delivery_base_fee) || 0;
  const perKm = num(form.delivery_per_km) || 0;
  const free = num(form.free_delivery_above);
  let fee;
  if (!base && !perKm) fee = "Delivery is free";
  else if (base && perKm) fee = `Fee = ${currency}${base} + ${currency}${perKm}/km`;
  else if (perKm) fee = `Fee = ${currency}${perKm}/km`;
  else fee = `Fee = ${currency}${base} flat`;
  if (free != null && (base || perKm)) fee += ` (free above ${currency}${free})`;

  return `Customers ${area} can order delivery. ${fee}.`;
}

export default function DeliverySettings({ form, setField, currency = "₹", hasLocation, disabled }) {
  const problems = deliveryProblems(form, hasLocation);
  const helper = form.delivery_enabled ? helperText(form, currency) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700">Pickup</p>
          <p className="text-xs text-gray-400">Customers collect the order from this branch</p>
        </div>
        <Switch checked={!!form.pickup_enabled} disabled={disabled}
          onCheckedChange={(on) => setField("pickup_enabled", on)} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t">
        <div>
          <p className="text-sm font-medium text-gray-700">Delivery</p>
          <p className="text-xs text-gray-400">You deliver to the customer's address</p>
        </div>
        <Switch checked={!!form.delivery_enabled} disabled={disabled}
          onCheckedChange={(on) => setField("delivery_enabled", on)} />
      </div>

      {!form.pickup_enabled && !form.delivery_enabled && (
        <p className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Both pickup and delivery are off, so customers can't order from this branch.
        </p>
      )}

      {form.delivery_enabled && (
        <div className="space-y-4 rounded-xl border bg-gray-50/60 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MoneyField label="Base fee" currency={currency} placeholder="0" disabled={disabled}
              value={form.delivery_base_fee} onChange={v => setField("delivery_base_fee", v)}
              hint="Charged on every delivery" />
            <MoneyField label="Fee per km" currency={currency} placeholder="0" disabled={disabled}
              value={form.delivery_per_km} onChange={v => setField("delivery_per_km", v)}
              hint="Straight-line distance from the branch" />
            <MoneyField label="Free delivery above (optional)" currency={currency} placeholder="e.g. 499" disabled={disabled}
              value={form.free_delivery_above} onChange={v => setField("free_delivery_above", v)}
              hint="Order value before GST" />
            <MoneyField label="Max distance (optional)" suffix="km" placeholder="e.g. 6" disabled={disabled}
              value={form.max_delivery_km} onChange={v => setField("max_delivery_km", v)}
              hint="Up to 100 km" />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Pincodes you deliver to (optional)</label>
            <PincodeListInput value={form.pincodes} disabled={disabled}
              onChange={v => setField("pincodes", v)} />
            <p className="text-xs text-gray-400 mt-1">
              Customers in these pincodes can order delivery even if they're beyond the max distance.
            </p>
          </div>

          {helper && (
            <p className="text-xs text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{helper}</p>
          )}
        </div>
      )}

      {problems.map(p => (
        <p key={p} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {p}
        </p>
      ))}
    </div>
  );
}

// Re-exported for the editor's number handling.
export { num };
