"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { MapPin, Clock, Truck, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import LocationPickerMap from "@/components/shop/LocationPickerMap";
import HoursEditor, { normalizeHours } from "./HoursEditor";
import DeliverySettings, { num } from "./DeliverySettings";

// The store part of Shop > Settings: location, opening hours, pickup and
// delivery, order rules. Edits the shared settings object; the Settings
// tab's one Save button sends everything (see toStorePayload).

// Settings -> the store fields of the PUT /shop-config body. Empty inputs
// become null (or 0 where the column can't be null); the server validates
// everything again.
export function toStorePayload(c) {
  const maxKm = num(c.max_delivery_km);
  const prep = num(c.prep_minutes);
  return {
    address: (c.address || "").trim() || null,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
    pincodes: c.pincodes || [],
    hours: normalizeHours(c.hours),
    timezone: c.timezone || "Asia/Kolkata",
    accepting_orders: c.accepting_orders !== false,
    pickup_enabled: c.pickup_enabled !== false,
    delivery_enabled: !!c.delivery_enabled,
    delivery_per_km: num(c.delivery_per_km) || 0,
    delivery_base_fee: num(c.delivery_base_fee) || 0,
    free_delivery_above: num(c.free_delivery_above),
    max_delivery_km: maxKm && maxKm > 0 ? maxKm : null,
    min_order_value: num(c.min_order_value) || 0,
    prep_minutes: prep == null ? null : Math.round(prep),
  };
}

// "12.9791, 80.2209" or a Google Maps URL containing "@12.97,80.22" / "q=12.97,80.22".
function parseCoords(text) {
  const m = String(text || "").match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

function Section({ icon: Icon, title, hint, children }) {
  return (
    <Card className="md:col-span-2">
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Icon size={15} className="text-gray-500" />{title}</h3>
          {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export default function StoreSettings({ config, setConfig, currency = "₹", disabled }) {
  const [coordText, setCoordText] = useState("");
  const setField = (key, value) => setConfig(c => ({ ...c, [key]: value }));
  const hasLocation = config.lat != null && config.lng != null;

  const applyCoordText = () => {
    const c = parseCoords(coordText);
    if (!c) { toast.error("Couldn't read those coordinates. Use the format 12.9791, 80.2209"); return; }
    setConfig(prev => ({ ...prev, ...c }));
    setCoordText("");
  };

  return (
    <>
      <Section icon={MapPin} title="Location"
        hint="Shown to customers who pick up, and used to measure delivery distance">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Address</label>
          <textarea rows={2} maxLength={300} disabled={disabled}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 resize-none"
            placeholder="12, 100 Feet Rd, Velachery, Chennai"
            value={config.address || ""} onChange={e => setField("address", e.target.value)} />
        </div>
        <LocationPickerMap
          value={hasLocation ? { lat: config.lat, lng: config.lng } : null}
          onChange={({ lat, lng }) => setConfig(c => ({ ...c, lat, lng }))}
          center={null}
          height={280}
          showLocateButton
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {hasLocation ? (
            <span className="text-gray-600 font-mono">{Number(config.lat).toFixed(6)}, {Number(config.lng).toFixed(6)}</span>
          ) : (
            <span className="text-gray-400">No pin yet. Tap the map or use your current location. Only needed for delivery by distance.</span>
          )}
          {hasLocation && (
            <button type="button" onClick={() => setConfig(c => ({ ...c, lat: null, lng: null }))}
              className="text-red-500 hover:underline">Clear</button>
          )}
        </div>
        <div className="flex gap-2">
          <Input className="text-xs" placeholder="Or paste coordinates, e.g. 12.9791, 80.2209"
            value={coordText} onChange={e => setCoordText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && applyCoordText()} />
          <Button type="button" variant="outline" size="sm" onClick={applyCoordText} disabled={!coordText.trim()}>
            Set
          </Button>
        </div>
      </Section>

      <Section icon={Clock} title="Opening hours" hint="Customers can browse any time but can only order while you're open">
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Taking orders</p>
            <p className="text-xs text-gray-400">Turn off to pause orders for a while (busy, out of stock). Customers can still browse.</p>
          </div>
          <Switch checked={config.accepting_orders !== false} disabled={disabled}
            onCheckedChange={(on) => setField("accepting_orders", on)} aria-label="Taking orders" />
        </div>
        <HoursEditor
          hours={config.hours ?? null}
          timezone={config.timezone || "Asia/Kolkata"}
          disabled={disabled}
          onChange={h => setField("hours", h)}
          onTimezoneChange={tz => setField("timezone", tz)}
        />
      </Section>

      <Section icon={Truck} title="Pickup & delivery">
        <DeliverySettings form={{ ...config, pickup_enabled: config.pickup_enabled !== false }}
          setField={setField} currency={currency} hasLocation={hasLocation} disabled={disabled} />
      </Section>

      <Section icon={SlidersHorizontal} title="Order rules">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Minimum order ({currency})</label>
            <Input type="number" min="0" placeholder="0" disabled={disabled}
              value={config.min_order_value ? String(config.min_order_value) : ""}
              onChange={e => setField("min_order_value", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ready in (minutes, optional)</label>
            <Input type="number" min="0" max="600" placeholder="e.g. 20" disabled={disabled}
              value={config.prep_minutes ?? ""}
              onChange={e => setField("prep_minutes", e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-gray-400">"Ready in" is shown to customers as "Ready in ~20 min". Leave it empty if it doesn't apply (e.g. you ship orders).</p>
      </Section>
    </>
  );
}
