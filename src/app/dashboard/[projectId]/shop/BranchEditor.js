"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Loader2, MapPin, Store, Clock, Truck, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import LocationPickerMap from "@/components/shop/LocationPickerMap";
import HoursEditor, { normalizeHours } from "./HoursEditor";
import DeliverySettings, { num } from "./DeliverySettings";
import ImageUploadField from "./ImageUploadField";

const str = (v) => (v == null || Number(v) === 0 ? "" : String(Number(v)));

function toForm(b, defaultTimezone) {
  return {
    name: b?.name || "",
    phone: b?.phone ? `+${String(b.phone).replace(/^\+/, "")}` : "",
    address: b?.address || "",
    image_url: b?.image_url || "",
    is_active: b ? b.is_active !== false : true,
    notify_owner_whatsapp: b ? b.notify_owner_whatsapp !== false : true,
    lat: b?.lat ?? null,
    lng: b?.lng ?? null,
    hours: b ? b.hours ?? null : null,
    timezone: b?.timezone || defaultTimezone || "Asia/Kolkata",
    pickup_enabled: b ? b.pickup_enabled !== false : true,
    delivery_enabled: b ? !!b.delivery_enabled : false,
    delivery_per_km: str(b?.delivery_per_km),
    delivery_base_fee: str(b?.delivery_base_fee),
    free_delivery_above: b?.free_delivery_above == null ? "" : String(Number(b.free_delivery_above)),
    max_delivery_km: str(b?.max_delivery_km),
    pincodes: Array.isArray(b?.pincodes) ? b.pincodes : [],
    min_order_value: str(b?.min_order_value),
    prep_minutes: b?.prep_minutes == null ? "" : String(b.prep_minutes),
    sort_order: b?.sort_order ? String(b.sort_order) : "",
  };
}

// Form -> request body (BranchUpsert). The server validates everything again.
function toPayload(f) {
  const maxKm = num(f.max_delivery_km);
  const prep = num(f.prep_minutes);
  return {
    name: f.name.trim(),
    phone: f.phone.trim() || null,
    address: f.address.trim() || null,
    image_url: f.image_url || null,
    is_active: !!f.is_active,
    notify_owner_whatsapp: f.notify_owner_whatsapp !== false,
    lat: f.lat ?? null,
    lng: f.lng ?? null,
    hours: normalizeHours(f.hours),
    timezone: f.timezone || "Asia/Kolkata",
    pickup_enabled: !!f.pickup_enabled,
    delivery_enabled: !!f.delivery_enabled,
    delivery_per_km: num(f.delivery_per_km) || 0,
    delivery_base_fee: num(f.delivery_base_fee) || 0,
    free_delivery_above: num(f.free_delivery_above),
    max_delivery_km: maxKm && maxKm > 0 ? maxKm : null,
    pincodes: f.pincodes || [],
    min_order_value: num(f.min_order_value) || 0,
    prep_minutes: prep == null ? null : Math.round(prep),
    sort_order: Math.round(num(f.sort_order) || 0),
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
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Icon size={15} className="text-gray-500" />{title}</h3>
          {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export default function BranchEditor({ branch, projectId, currency = "₹", defaultTimezone, onClose, onSaved }) {
  const isNew = !branch;
  const [form, setForm] = useState(() => toForm(branch, defaultTimezone));
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [coordText, setCoordText] = useState("");

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const hasLocation = form.lat != null && form.lng != null;

  const applyCoordText = () => {
    const c = parseCoords(coordText);
    if (!c) { toast.error("Couldn't read those coordinates. Use the format 12.9791, 80.2209"); return; }
    setForm(f => ({ ...f, ...c }));
    setCoordText("");
  };

  const save = async () => {
    if (!form.name.trim()) { setError("Give the branch a name."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(form);
      let res;
      if (isNew) {
        res = await fetch("/api/shop-branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId, ...payload }),
        });
      } else {
        // Only changed keys (the backend treats an explicit null as "clear").
        const before = toPayload(toForm(branch, defaultTimezone));
        const changes = Object.fromEntries(
          Object.entries(payload).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k]))
        );
        if (makeDefault) changes.make_default = true;
        if (Object.keys(changes).length === 0) { onClose(); return; }
        res = await fetch(`/api/shop-branches/${branch.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save this branch.");
        return;
      }
      if (isNew && makeDefault && data.id) {
        const r2 = await fetch(`/api/shop-branches/${data.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ make_default: true }),
        });
        if (!r2.ok) {
          const e2 = await r2.json().catch(() => ({}));
          toast.error(e2.error || "Branch saved, but it couldn't be made the default.");
        }
      }
      toast.success(isNew ? "Branch added" : "Branch saved");
      onSaved?.(data);
    } catch (e) {
      console.error(e);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 shrink-0">
            <ChevronLeft size={16} /> Branches
          </button>
          <span className="text-gray-300">/</span>
          <span className="font-semibold text-gray-900 truncate">{isNew ? "New branch" : branch.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Section icon={Store} title="Basics">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Branch name *</label>
                <Input placeholder="e.g. Velachery" maxLength={80}
                  value={form.name} onChange={e => setField("name", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                <Input placeholder="+91 98765 43210" inputMode="tel"
                  value={form.phone} onChange={e => setField("phone", e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">Shown to customers & receives this branch's new-order alerts on WhatsApp</p>
                <div className="flex items-center justify-between gap-3 mt-3 rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">WhatsApp alert for new orders</p>
                    <p className="text-xs text-gray-400">
                      {form.phone.trim()
                        ? "Sent to the phone above. Turn it off to watch orders in the dashboard only."
                        : "Add a phone above to receive alerts. Until then this branch sends none."}
                    </p>
                  </div>
                  <Switch checked={form.notify_owner_whatsapp !== false}
                    onCheckedChange={(v) => setField("notify_owner_whatsapp", !!v)} aria-label="WhatsApp alert for new orders" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Address</label>
                <textarea rows={2} maxLength={300}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 resize-none"
                  placeholder="12, 100 Feet Rd, Velachery, Chennai"
                  value={form.address} onChange={e => setField("address", e.target.value)} />
              </div>
              <ImageUploadField
                label="Photo"
                hint="Shown next to the branch when customers pick one. Saved with the branch."
                value={form.image_url}
                aspect="16 / 9"
                onChange={(url) => setField("image_url", url || "")}
              />
              <div className="flex items-center justify-between gap-3 pt-2 border-t">
                <div>
                  <p className="text-sm font-medium text-gray-700">Branch is active</p>
                  <p className="text-xs text-gray-400">Turn off to hide this branch from customers</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={on => setField("is_active", on)} />
              </div>
              {(isNew || !branch.is_default) && (
                <label className="flex items-start gap-2 pt-2 border-t cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)} />
                  <span>
                    <span className="text-sm font-medium text-gray-700 block">Make this the default branch</span>
                    <span className="text-xs text-gray-400">Used for products imported from Shopify and for the AI's menu answers. Customers still choose their own branch.</span>
                  </span>
                </label>
              )}
            </div>
          </Section>

          <Section icon={MapPin} title="Location"
            hint="Used to find the nearest branch for customers and to measure delivery distance">
            <LocationPickerMap
              value={hasLocation ? { lat: form.lat, lng: form.lng } : null}
              onChange={({ lat, lng }) => setForm(f => ({ ...f, lat, lng }))}
              center={null}
              height={300}
              showLocateButton
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {hasLocation ? (
                <span className="text-gray-600 font-mono">{Number(form.lat).toFixed(6)}, {Number(form.lng).toFixed(6)}</span>
              ) : (
                <span className="text-gray-400">No location yet. Click the map or use your current location.</span>
              )}
              {hasLocation && (
                <button type="button" onClick={() => setForm(f => ({ ...f, lat: null, lng: null }))}
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
        </div>

        <div className="space-y-4">
          <Section icon={Clock} title="Opening hours" hint="Customers can browse anytime but can only order while you're open">
            <HoursEditor
              hours={form.hours}
              timezone={form.timezone}
              onChange={h => setField("hours", h)}
              onTimezoneChange={tz => setField("timezone", tz)}
            />
          </Section>

          <Section icon={Truck} title="Pickup & delivery">
            <DeliverySettings form={form} setField={setField} currency={currency} hasLocation={hasLocation} />
          </Section>

          <Section icon={SlidersHorizontal} title="Extras">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Minimum order ({currency})</label>
                <Input type="number" min="0" placeholder="0"
                  value={form.min_order_value} onChange={e => setField("min_order_value", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Prep time (minutes)</label>
                <Input type="number" min="0" max="600" placeholder="e.g. 20"
                  value={form.prep_minutes} onChange={e => setField("prep_minutes", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Sort order</label>
                <Input type="number" min="0" placeholder="0"
                  value={form.sort_order} onChange={e => setField("sort_order", e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-gray-400">Prep time is shown to customers as "Ready in ~20 min". Lower sort order shows first.</p>
          </Section>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving || !form.name.trim()}>
          {saving ? <><Loader2 size={14} className="animate-spin mr-2" />Saving...</> : isNew ? "Add branch" : "Save branch"}
        </Button>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}
